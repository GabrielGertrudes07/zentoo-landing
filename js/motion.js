/* Camada de movimento da Zentoo.
 *
 * Ordem dos acontecimentos:
 *   1. abertura em tela cheia (logo + nome), com o scroll preso
 *   2. a abertura sobe e sai, revelando a página
 *   3. o hero entra
 *   4. daí para baixo o scroll comanda: descendo constrói, subindo desmonta
 *
 * Regras que valem para tudo aqui:
 *  - o estado padrão da página é "visível". Os estados iniciais vêm do CSS
 *    sob a classe `js`, e o script inline do <head> devolve tudo ao normal
 *    se este arquivo não rodar — inclusive soltando o scroll e sumindo com
 *    a abertura. Ninguém fica preso atrás de uma logo parada.
 *  - só se anima transform, opacity, clip-path e stroke-dashoffset.
 *  - prefers-reduced-motion desliga tudo: abertura, linha, pin e Lenis.
 *  - nada é preso numa tela onde a seção não caiba: seria conteúdo cortado.
 */
(function () {
  'use strict';

  var root = document.documentElement;

  function soltaTudo() {
    root.classList.remove('js', 'intro-on');
    var el = document.getElementById('intro');
    if (el) el.remove();
  }

  if (!window.gsap || !window.ScrollTrigger) return;   // o <head> resolve

  window.__zAnim = true;
  gsap.registerPlugin(ScrollTrigger);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    soltaTudo();
    return;
  }

  var EASE = 'expo.out';
  var main = document.querySelector('main');
  var svg = document.querySelector('.thread');
  var SVGNS = 'http://www.w3.org/2000/svg';
  var c24 = document.getElementById('count-24');

  /* ------------------------------------------------------------------ *
   * Lenis: inércia no scroll. Nasce parado por causa da abertura. O ticker
   * do GSAP é o relógio dos dois — em rAFs separados o conteúdo preso treme.
   * ------------------------------------------------------------------ */
  var lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    lenis.stop();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);

    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      var alvo = a.getAttribute('href');
      if (!alvo || alvo === '#') return;
      a.addEventListener('click', function (e) {
        var el = document.querySelector(alvo);
        if (!el) return;
        e.preventDefault();
        lenis.scrollTo(el, { offset: -72 });
      });
    });
  }

  function countTo(el, to, delay) {
    if (!el || isNaN(to)) return;
    var o = { v: 0 };
    gsap.to(o, {
      v: to, duration: 1.1, delay: delay || 0, ease: 'power2.out',
      onUpdate: function () { el.textContent = String(Math.round(o.v)).padStart(2, '0'); }
    });
  }

  /* ------------------------------------------------------------------ *
   * 1 e 2. Abertura.
   * ------------------------------------------------------------------ */
  function abertura(pronto) {
    var intro = document.getElementById('intro');
    if (!intro) { pronto(); return; }

    window.scrollTo(0, 0);

    var box = intro.querySelector('.im-box');
    var len = box ? box.getTotalLength() : 0;
    if (box) gsap.set(box, { strokeDasharray: len, strokeDashoffset: len });
    gsap.set('.im-dot', { scale: 0, transformOrigin: 'center' });
    gsap.set('.intro-word', { yPercent: 45, opacity: 0 });
    gsap.set('.intro-sub', { opacity: 0 });
    gsap.set('.intro-rule', { scaleX: 0 });

    gsap.timeline({ onComplete: pronto })
      .to(box, { strokeDashoffset: 0, duration: 0.66, ease: 'power2.inOut' }, 0)
      .to('.im-dot', { scale: 1, duration: 0.45, ease: EASE }, 0.38)
      .to('.intro-word', { yPercent: 0, opacity: 1, duration: 0.6, ease: EASE }, 0.3)
      .to('.intro-sub', { opacity: 1, duration: 0.45, ease: EASE }, 0.56)
      .to('.intro-rule', { scaleX: 1, duration: 0.55, ease: 'power2.inOut' }, 0.6)
      // a abertura sobe e sai, e a página fica à mostra por baixo
      .to('.intro-stack, .intro-sub, .intro-rule', { opacity: 0, duration: 0.35, ease: 'none' }, 1.2)
      .to(intro, { yPercent: -100, duration: 0.8, ease: 'expo.inOut' }, 1.24);
  }

  /* ------------------------------------------------------------------ *
   * 3. Entrada do hero.
   * ------------------------------------------------------------------ */
  function heroEntra() {
    gsap.timeline({ defaults: { ease: EASE, duration: 0.9 } })
      .fromTo('.hero h1 .l', { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.09 }, 0)
      .fromTo('.hero .lead', { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, 0.2)
      .fromTo('.hero-actions', { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, 0.3)
      .fromTo('.figure', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 1.05 }, 0.14);
    countTo(c24, 24, 0.6);
  }

  /* ------------------------------------------------------------------ *
   * A linha: costura vertical desenhada conforme o scroll. Como é `scrub`,
   * ela se desenha descendo e se apaga subindo, sem código extra.
   * ------------------------------------------------------------------ */
  function node(tag, attrs, cls) {
    var n = document.createElementNS(SVGNS, tag);
    if (cls) n.setAttribute('class', cls);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  var th = null;

  function initThread() {
    if (!svg) return;
    th = {
      segs: [node('path', {}, 'th-track'), node('path', {}, 'th-track on-dark'), node('path', {}, 'th-track')],
      draw: node('path', {}, 'th-draw'),
      head: node('circle', { r: 5 }, 'th-head'),
      marks: [], y0: 0, y1: 0, len: 0, p: 0, mainTop: 0
    };
    th.segs.forEach(function (s) { svg.appendChild(s); });
    svg.appendChild(th.draw);
    ['#s-sinais', '#s-como', '#trabalhos'].forEach(function (sel) {
      var sec = document.querySelector(sel);
      if (!sec) return;
      var m = { sec: sec, dot: node('circle', { r: 6 }, 'th-node'), tick: node('path', {}, 'th-tick') };
      m.tick.style.opacity = 0;
      svg.appendChild(m.dot);
      svg.appendChild(m.tick);
      th.marks.push(m);
    });
    svg.appendChild(th.head);
  }

  // Posição no documento levando em conta o espaçador que o `pin` cria: o
  // espaçador continua no fluxo, a seção presa não.
  function outer(el) {
    return (el.parentElement && el.parentElement.classList.contains('pin-spacer')) ? el.parentElement : el;
  }
  function docTop(el) {
    return outer(el).getBoundingClientRect().top + window.scrollY - th.mainTop;
  }

  function layoutThread() {
    if (!th || !svg) return;
    var hero = document.querySelector('#s-hero');
    var dark = document.querySelector('#trabalhos');
    var close = document.querySelector('#s-close');
    if (!hero || !dark || !close) return;

    th.mainTop = main.getBoundingClientRect().top + window.scrollY;

    var W = main.offsetWidth, H = main.offsetHeight;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);

    // x na metade da margem esquerda, com piso para telas estreitas: a linha
    // nunca encosta no texto, em nenhuma largura
    var wrapEl = document.querySelector('.hero .wrap');
    var gutter = wrapEl.getBoundingClientRect().left - main.getBoundingClientRect().left;
    var x = Math.min(90, Math.max(7, gutter / 2));
    var comTick = gutter >= 60;

    var y0 = docTop(hero) + outer(hero).offsetHeight - 20;
    var y1 = docTop(close) - 20;   // para onde o âmbar começa: âmbar sobre âmbar sumiria
    if (y1 <= y0) { svg.style.display = 'none'; return; }
    svg.style.display = '';

    var dTop = docTop(dark);
    var dBot = dTop + outer(dark).offsetHeight;

    function seg(el, a, b) {
      a = Math.max(a, y0); b = Math.min(b, y1);
      if (b <= a) { el.removeAttribute('d'); return; }
      el.setAttribute('d', 'M' + x + ' ' + a + 'V' + b);
    }
    seg(th.segs[0], y0, dTop);
    seg(th.segs[1], dTop, dBot);   // trecho sobre a faixa preta, cinza mais claro
    seg(th.segs[2], dBot, y1);

    th.draw.setAttribute('d', 'M' + x + ' ' + y0 + 'V' + y1);
    th.y0 = y0; th.y1 = y1; th.len = y1 - y0;

    th.marks.forEach(function (m) {
      var h = m.sec.querySelector('h2');
      if (!h) return;
      var y = docTop(m.sec) + h.offsetTop + h.offsetHeight / 2;
      var fora = y < y0 || y > y1;
      m.dot.setAttribute('cx', x);
      m.dot.setAttribute('cy', y);
      m.dot.setAttribute('class', 'th-node' + ((y >= dTop && y <= dBot) ? ' on-dark' : ''));
      m.dot.style.display = fora ? 'none' : '';
      m.tick.setAttribute('d', 'M' + (x + 10) + ' ' + y + 'h26');
      m.tick.style.display = (fora || !comTick) ? 'none' : '';
    });

    th.head.setAttribute('cx', x);
    paintThread(th.p);
  }

  function paintThread(p) {
    if (!th || !th.len) return;
    th.p = p;
    th.draw.setAttribute('stroke-dasharray', th.len);
    th.draw.setAttribute('stroke-dashoffset', th.len * (1 - p));
    th.head.setAttribute('cy', th.y0 + th.len * p);
    th.head.style.opacity = (p > 0.005 && p < 0.995) ? 1 : 0;
  }

  initThread();

  var proxy = { p: 0 };
  gsap.to(proxy, {
    p: 1, ease: 'none',
    scrollTrigger: { trigger: main, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
    onUpdate: function () { paintThread(proxy.p); }
  });

  if (th) {
    th.marks.forEach(function (m) {
      ScrollTrigger.create({
        trigger: m.sec, start: 'top 70%', end: 'bottom 30%',
        onToggle: function (self) {
          gsap.to(m.dot, { attr: { r: self.isActive ? 8 : 6 }, fill: self.isActive ? 'var(--amber)' : '', duration: 0.4, ease: EASE });
          gsap.to(m.tick, { opacity: self.isActive ? 1 : 0, duration: 0.4, ease: EASE });
        }
      });
    });
  }

  /* parallax do papel milimetrado — `scrub`, então também anda de ré */
  gsap.to('.grid-layer', {
    y: function () { return window.innerHeight * 0.16; },
    ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true }
  });

  /* ------------------------------------------------------------------ *
   * 4. Revelações reversíveis.
   * `toggleActions: play none none reverse` é o que faz a página se
   * desmontar quando o scroll volta: entra tocando, sai de ré.
   * ------------------------------------------------------------------ */
  function revela(trigger, monta, start) {
    var tl = gsap.timeline({
      scrollTrigger: { trigger: trigger, start: start || 'top 78%', toggleActions: 'play none none reverse' }
    });
    monta(tl);
    return tl;
  }

  // sinais: a linha sobe e o traço âmbar é riscado, item por item
  revela('#s-sinais', function (tl) {
    tl.fromTo('#s-sinais [data-anim]:not(li)', { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.85, ease: EASE, stagger: 0.1 }, 0)
      .fromTo('.spec li', { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: EASE, stagger: 0.075 }, 0.1)
      .fromTo('.spec .tick', { scaleX: 0 },
        { scaleX: 1, duration: 0.5, ease: EASE, stagger: 0.075 }, 0.22);
  });

  // etapas: entram na ordem e os números contam — sequência de verdade.
  // Os contadores vivem na mesma timeline, então voltam a 00 de ré.
  revela('#s-como', function (tl) {
    tl.fromTo('#s-como [data-anim]:not(.step)', { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.85, ease: EASE, stagger: 0.1 }, 0)
      .fromTo('.step', { y: 26, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.14 }, 0.08);
    document.querySelectorAll('.step .num').forEach(function (el, i) {
      var o = { v: 0 };
      tl.to(o, {
        v: parseInt(el.dataset.count, 10), duration: 1, ease: 'power2.out',
        onUpdate: function () { el.textContent = String(Math.round(o.v)).padStart(2, '0'); }
      }, 0.2 + i * 0.14);
    });
  });

  // fechamento: o âmbar inunda de baixo para cima, e recua igual na volta
  revela('#s-close', function (tl) {
    tl.fromTo('#s-close', { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: EASE }, 0)
      .fromTo('#s-close [data-anim]', { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.1 }, 0.3);
  });

  /* ------------------------------------------------------------------ *
   * Pin + scrub na faixa de trabalhos. Só onde a seção cabe na tela —
   * prender algo mais alto que o viewport corta conteúdo, que é o pecado
   * clássico da técnica. O matchMedia desfaz tudo sozinho ao trocar de faixa.
   * ------------------------------------------------------------------ */
  var mm = gsap.matchMedia();

  mm.add('(min-width: 900px)', function () {
    var dark = document.querySelector('#trabalhos');
    if (dark && dark.offsetHeight <= window.innerHeight) {
      var t2 = gsap.timeline({
        scrollTrigger: {
          trigger: dark, start: 'top top', end: '+=110%',
          pin: true, pinSpacing: true, scrub: 0.5, anticipatePin: 1, invalidateOnRefresh: true
        }
      });
      t2.fromTo('#trabalhos [data-anim]:not(li)', { y: 20, opacity: 0 },
        { y: 0, opacity: 1, ease: 'none', duration: 0.08, stagger: 0.04 }, 0);
      gsap.utils.toArray('#trabalhos .work li').forEach(function (li, i) {
        t2.fromTo(li, { y: 26, opacity: 0 }, { y: 0, opacity: 1, ease: 'none', duration: 0.09 }, 0.16 + i * 0.16);
      });
    } else {
      revela('#trabalhos', function (tl) {
        tl.fromTo('#trabalhos [data-anim]', { y: 22, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.09 }, 0);
      }, 'top 72%');
    }
  });

  mm.add('(max-width: 899px)', function () {
    revela('#trabalhos', function (tl) {
      tl.fromTo('#trabalhos [data-anim]', { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.09 }, 0);
    }, 'top 72%');
  });

  /* ------------------------------------------------------------------ *
   * Remedição: o `pin` insere espaçador, então a linha só pode ser
   * posicionada depois que o ScrollTrigger termina de calcular tudo.
   * ------------------------------------------------------------------ */
  ScrollTrigger.addEventListener('refresh', layoutThread);
  layoutThread();
  ScrollTrigger.refresh();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }

  // agora sim: abertura, e no fim dela o scroll é solto e o hero entra
  abertura(function () {
    root.classList.remove('intro-on');
    var el = document.getElementById('intro');
    if (el) el.remove();
    if (lenis) lenis.start();
    ScrollTrigger.refresh();
    heroEntra();
  });
})();
