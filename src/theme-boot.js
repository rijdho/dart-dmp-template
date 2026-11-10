// Put the stored theme on <html> before first paint, so a visitor who chose the dark theme
// does not see a white page while the modules load. It is a file of its own because the
// page's Content-Security-Policy allows no inline script; a plain script in the head blocks
// rendering, so it runs before anything is painted.
(function () {
  try {
    var t = localStorage.getItem('dart-dmp-template:theme');
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  } catch (e) {
    /* storage unavailable: the system preference applies */
  }
})();
