(() => {
  'use strict';

  const SUPABASE_URL = 'https://fgbnonnhkgwdsgatjloa.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnYm5vbm5oa2d3ZHNnYXRqbG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjk5OTMsImV4cCI6MjEwNTc0NTk5M30.GjhCHXjOO0BIpOxUWSGKx2mV1JKHRSyJWijg25Ix8Dk';

  if (!window.supabase) {
    console.error('Le SDK Supabase n’est pas chargé.');
    window.location.replace('login.html');
    return;
  }

  // Initialisation du client global
  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.capitaleSupabase = supabaseClient;

  async function protectApplication() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (error || !session) {
      window.location.replace('login.html');
      return;
    }

    const user = session.user;
    window.capitaleUser = user;

    // Mise à jour visuelle du statut
    const badge = document.getElementById('dbStatus');
    if (badge) {
      badge.textContent = 'Connecté';
      badge.className = 'badge green';
    }

    const avatar = document.querySelector('.avatar');
    if (avatar && user.email) {
      avatar.textContent = user.email.slice(0, 2).toUpperCase();
    }

    // Ajout du bouton déconnexion
    const sidebarBottom = document.querySelector('.sidebar-bottom');
    if (sidebarBottom && !document.getElementById('logoutBtn')) {
      const logoutBtn = document.createElement('button');
      logoutBtn.id = 'logoutBtn';
      logoutBtn.className = 'btn light';
      logoutBtn.textContent = 'Se déconnecter';
      logoutBtn.style.cssText = 'width:100%; margin-top:12px;';
      logoutBtn.onclick = async () => {
        await supabaseClient.auth.signOut();
        window.location.replace('login.html');
      };
      sidebarBottom.appendChild(logoutBtn);
    }

    // Lancement de l'application
    window.dispatchEvent(new CustomEvent('capitale:ready', { detail: user }));
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      window.location.replace('login.html');
    }
  });

  protectApplication();
})();