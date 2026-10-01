// Application pages: on-this-page nav, image lightbox, outward links. From epoch-ai-application.html.
(function () {
  const $ = id => document.getElementById(id);

  // ---- On this page ----
  const tocItems = [...document.querySelectorAll('[data-toc]')];
  $('toc-list').innerHTML = tocItems.map(el => `<li><a href="#${el.id}">${el.dataset.toc}</a></li>`).join('');
  const tocLinks = [...document.querySelectorAll('#toc-list a')];
  const tocMark = id => tocLinks.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) tocMark(e.target.id); }), { rootMargin: '-30% 0px -60% 0px' });
  tocItems.forEach(el => io.observe(el));
  // The first and last sections are too short to cross the marker band: pin them at the page ends.
  const tocEnds = () => {
    if (!tocItems.length) return;
    if (scrollY < 200) tocMark(tocItems[0].id);
    else if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) tocMark(tocItems[tocItems.length - 1].id);
  };
  addEventListener('scroll', tocEnds, { passive: true }); tocEnds();

  // ---- Lightbox for every enlargeable image ----
  const lb = $('lightbox');
  document.querySelectorAll('.zoom').forEach(z => z.addEventListener('click', () => {
    const img = z.querySelector('img'), cap = z.closest('figure, .wcard')?.querySelector('figcaption, h3');
    $('lb-img').src = img.src; $('lb-img').alt = img.alt; $('lb-cap').textContent = cap ? cap.textContent.trim() : '';
    lb.showModal();
  }));
  lb.querySelector('.lb-close').onclick = () => lb.close();
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });

  // ---- Every link that leaves this page opens in a new tab ----
  const outward = () => document.querySelectorAll('a[href]').forEach(a => {
    const h = a.getAttribute('href'); if (h.startsWith('#') || h.startsWith('mailto:')) return;
    a.target = '_blank'; a.rel = 'noopener';
  });
  outward(); setTimeout(outward, 1500);
})();
