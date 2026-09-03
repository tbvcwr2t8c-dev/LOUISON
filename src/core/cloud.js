// Supabase Auth + PostgREST. Tokens are kept apart from exported application data.
// Cloud snapshots are append-only: another device can never overwrite a backup.
const AUTH='constante_cloud_auth', DEVICE='constante_cloud_device', ENABLED='constante_cloud_enabled';
export class CloudBackup {
  constructor({config,storage,readState,notify=()=>{},fetcher=(...args)=>fetch(...args)}) {
    Object.assign(this,{config,storage,readState,notify,fetcher});
    this.configured=!!config.url && !!config.key;
    this.session=null;try{this.session=JSON.parse(storage.getItem(AUTH)||'null');}catch{}
    this.enabled=storage.getItem(ENABLED)==='true';this.message='Sauvegarde locale sur cet appareil';this.lastDigest=null;this.busy=false;this.pending=false;
  }
  async request(path,{method='GET',body,token,headers={}}={}) {
    if(!this.configured)throw Error('La sauvegarde en ligne n’est pas encore configurée.');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await this.fetcher(this.config.url+path,{method,signal:controller.signal,headers:{apikey:this.config.key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
      if(!response.ok) {
        let details={};try{details=JSON.parse(await response.text());}catch{}
        const messages={otp_expired:'Ce lien a expiré ou a déjà été utilisé. Demande un nouveau lien, puis copie-le sans l’ouvrir.',email_address_not_authorized:'Le service d’e-mail doit être configuré pour autoriser cette adresse.',over_email_send_rate_limit:'La limite d’envoi des e-mails est atteinte. Réessaie plus tard.',email_provider_disabled:'La connexion par e-mail n’est pas activée.'};
        throw Error(messages[details.error_code||details.code] || (response.status===401?'Reconnecte-toi pour reprendre la sauvegarde.':response.status===429?'Trop de demandes. Réessaie dans quelques instants.':'Le serveur de sauvegarde ne répond pas correctement. Tes données restent sur cet appareil.'));
      }
      const text=await response.text();return text?JSON.parse(text):null;
    } finally {clearTimeout(timeout);}
  }
  async sendCode(email) {
    await this.request('/auth/v1/otp',{method:'POST',body:{email,create_user:true}});
  }
  async verifyCode(email,token) {
    const session=await this.request('/auth/v1/verify',{method:'POST',body:{email,token,type:'email'}});
    this.keepSession(session);this.enabled=false;this.storage.setItem(ENABLED,'false');this.notify();
  }
  async verifyLink(value,expectedEmail) {
    let link;try{link=new URL(value);}catch{throw Error('Colle le lien complet du bouton reçu par e-mail.');}
    if(link.origin!==new URL(this.config.url).origin || link.pathname!=='/auth/v1/verify')throw Error('Ce lien ne vient pas du service de connexion Constante.');
    const token_hash=link.searchParams.get('token'),type=link.searchParams.get('type');
    if(!token_hash || !['email','signup','magiclink'].includes(type))throw Error('Lien de connexion non reconnu.');
    const session=await this.request('/auth/v1/verify',{method:'POST',body:{token_hash,type}});
    if(expectedEmail && session?.user?.email?.toLowerCase()!==expectedEmail.toLowerCase())throw Error('Ce lien correspond à une autre adresse e-mail.');
    this.keepSession(session);this.enabled=false;this.storage.setItem(ENABLED,'false');this.lastDigest=null;this.notify();
  }
  keepSession(session) {
    if(!session?.access_token || !session?.refresh_token || !session.user?.id)throw Error('Connexion incomplète.');
    this.session={...session,expires_at:session.expires_at||Math.floor(Date.now()/1000)+session.expires_in};
    this.storage.setItem(AUTH,JSON.stringify(this.session));
  }
  async token() {
    if(!this.session)throw Error('Connecte-toi pour accéder à tes sauvegardes.');
    if(this.session.expires_at*1000<Date.now()+60000) {
      const user=this.session.user.id;
      const session=await this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:this.session.refresh_token}});
      if(this.session?.user.id!==user)throw Error('Le compte a changé.');
      this.keepSession(session);
    }
    return this.session.access_token;
  }
  setEnabled(enabled) {this.enabled=enabled;this.storage.setItem(ENABLED,String(enabled));if(enabled)this.schedule();else{this.message='Sauvegarde en ligne en pause';this.notify();}}
  async signOut() {
    const token=this.session?.access_token;
    this.session=null;this.enabled=false;this.lastDigest=null;this.storage.removeItem(AUTH);this.storage.removeItem(ENABLED);this.notify();
    if(token)try{await this.request('/auth/v1/logout',{method:'POST',token});}catch{}
  }
  schedule() {
    if(!this.configured || !this.enabled || !this.session)return;
    this.pending=true;clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),1000);
  }
  async flush() {
    if(this.busy || !this.pending || !this.enabled || !this.session)return;
    this.busy=true;this.pending=false;const user=this.session.user.id;
    try {
      const payload=JSON.parse(JSON.stringify(this.readState())),raw=JSON.stringify(payload);
      if(new TextEncoder().encode(raw).length>2000000)throw Error('Sauvegarde volumineuse : exporte tes données dans Fichiers.');
      const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('');
      if(digest===this.lastDigest)return;
      const token=await this.token();if(this.session?.user.id!==user || !this.enabled)return;
      let device=this.storage.getItem(DEVICE);if(!device){device=crypto.randomUUID();this.storage.setItem(DEVICE,device);}
      this.message='Sauvegarde en cours…';this.notify();
      await this.request('/rest/v1/constante_backups?on_conflict=user_id,device_id,digest',{method:'POST',token,headers:{Prefer:'resolution=ignore-duplicates'},body:{user_id:user,device_id:device,digest,payload}});
      // Verify persisted digest before declaring success, including duplicate retries.
      const rows=await this.request(`/rest/v1/constante_backups?select=id,created_at&user_id=eq.${encodeURIComponent(user)}&device_id=eq.${encodeURIComponent(device)}&digest=eq.${digest}&limit=1`,{token});
      if(!rows?.length)throw Error('La sauvegarde n’a pas pu être vérifiée.');
      if(this.session?.user.id!==user)return;
      this.lastDigest=digest;this.message='Sauvegardé en ligne à '+new Intl.DateTimeFormat('fr-FR',{hour:'2-digit',minute:'2-digit'}).format(new Date(rows[0].created_at));this.notify();
    } catch(error) {this.pending=true;this.message=error.message;this.notify();}
    finally {this.busy=false;if(this.pending && this.enabled && this.session){clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(),30000);}}
  }
  async list() {
    const token=await this.token();return this.request('/rest/v1/constante_backups?select=id,created_at,device_id&order=created_at.desc&limit=20',{token});
  }
  async retrieve(id) {
    const token=await this.token();const rows=await this.request(`/rest/v1/constante_backups?select=payload&id=eq.${encodeURIComponent(id)}&limit=1`,{token});
    if(!rows?.[0]?.payload)throw Error('Sauvegarde introuvable.');return rows[0].payload;
  }
}
