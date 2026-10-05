(() => {
  'use strict';

  const SUPABASE_URL =
    'https://fgbnonnhkgwdsgatjloa.supabase.co';

  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnYm5vbm5oa2d3ZHNnYXRqbG9hIiwicm9sIjoiYW5vbiIsImlhdCI6MTc5MDE2OTk5MywiZXhwIjoyMTA1NzQ1OTkzfQ.GjhCHXjOO0BIpOxUWSGKx2mV1JKHRSyJWijg25Ix8Dk';

  console.log('[CAPITALE TT] auth_guard.js chargé');

  if (!window.supabase) {
    console.error('[CAPITALE TT] SDK Supabase non chargé');
    window.location.replace('login.html');
    return;
  }

  const supabaseClient =
    window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

  window.capitaleSupabase = supabaseClient;

  async function protectApplication() {
    console.log('[CAPITALE TT] Vérification de la session...');

    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) {
      console.error(
        '[CAPITALE TT] Erreur de session :',
        error
      );

      window.location.replace('login.html');
      return;
    }

    const session = data?.session;

    if (!session) {
      console.warn(
        '[CAPITALE TT] Aucune session. Redirection vers login.html'
      );

      window.location.replace('login.html');
      return;
    }

    const user = session.user;

    console.log(
      '[CAPITALE TT] Session valide pour :',
      user.email
    );

    window.capitaleUser = user;

    const badge =
      document.getElementById('dbStatus');

    if (badge) {
      badge.textContent = 'Connecté';
      badge.className = 'badge green';
      badge.title = user.email || '';
    }

    const avatar =
      document.querySelector('.avatar');

    if (avatar && user.email) {
      avatar.textContent =
        user.email.slice(0, 2).toUpperCase();

      avatar.title = user.email;
    }

    const sidebarBottom =
      document.querySelector('.sidebar-bottom');

    if (
      sidebarBottom &&
      !document.getElementById('logoutBtn')
    ) {
      const logoutButton =
        document.createElement('button');

      logoutButton.id = 'logoutBtn';
      logoutButton.className = 'btn light';
      logoutButton.textContent = 'Se déconnecter';

      logoutButton.style.cssText = `
        width:100%;
        margin-top:12px;
      `;

      logoutButton.addEventListener(
        'click',
        async () => {
          logoutButton.disabled = true;
          logoutButton.textContent =
            'Déconnexion...';

          const { error: signOutError } =
            await supabaseClient.auth.signOut();

          if (signOutError) {
            console.error(
              '[CAPITALE TT] Erreur de déconnexion :',
              signOutError
            );

            logoutButton.disabled = false;
            logoutButton.textContent =
              'Se déconnecter';

            alert(
              'Déconnexion impossible : ' +
              signOutError.message
            );

            return;
          }

          window.location.replace('login.html');
        }
      );

      sidebarBottom.appendChild(logoutButton);
    }

    window.dispatchEvent(
      new CustomEvent('capitale:ready', {
        detail: user
      })
    );
  }

  supabaseClient.auth.onAuthStateChange(
    (event, session) => {
      console.log(
        '[CAPITALE TT] Événement Auth :',
        event
      );

      if (
        event === 'SIGNED_OUT' ||
        !session
      ) {
        window.location.replace('login.html');
      }
    }
  );

  protectApplication();
})();
