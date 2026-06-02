/* Pause animations until everything has loaded (same pattern as portfolio/gamedev) */
document.body && document.body.classList.add('js-loading');

/* ---- Theme: set before paint to avoid a flash ---- */
(function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem('theme'); } catch (e) {}
    var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    var theme = stored || (prefersLight ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
})();

function applyToggleIcon(theme) {
    var icon = document.querySelector('#theme-toggle .material-symbols-outlined');
    if (icon) icon.textContent = theme === 'light' ? 'light_mode' : 'dark_mode';
}

window.addEventListener('load', function showPage() {
    document.body.classList.remove('js-loading');
});

document.addEventListener('DOMContentLoaded', function () {
    /* Theme toggle */
    var current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyToggleIcon(current);

    var toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.addEventListener('click', function () {
            var next = (document.documentElement.getAttribute('data-theme') === 'light') ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            applyToggleIcon(next);
            try { localStorage.setItem('theme', next); } catch (e) {}
        });
    }

    /* Scroll reveal — preserves the .animation-appear pattern, now actually scroll-triggered */
    var revealEls = document.querySelectorAll('.animation-appear');
    if (!('IntersectionObserver' in window)) {
        revealEls.forEach(function (el) { el.classList.add('in-view'); });
        return;
    }
    var observer = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    revealEls.forEach(function (el) { observer.observe(el); });
});
