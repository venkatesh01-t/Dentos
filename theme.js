(function() {
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme) {
        document.documentElement.setAttribute('data-theme', storedTheme);
      } else {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', systemDark ? 'dark' : 'light');
      }
    })();