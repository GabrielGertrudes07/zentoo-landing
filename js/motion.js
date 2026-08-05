/* Camada de movimento da Zentoo.
 *
 * Técnica central, a mesma do site do GTA VI: a seção fica presa na tela
 * (`pin`) e o scroll arrasta a animação quadro a quadro (`scrub` com
 * `ease: "none"`). Você não rola até a próxima seção, rola dentro dela.
 *
 * Regras que valem para tudo aqui:
 *  - o estado padrão da página é "visível". Os estados iniciais vêm do CSS
 *    sob a classe `js`, e o script inline do <head> devolve tudo ao normal
 *    se este arquivo não rodar. Nada de conteúdo preso invisível.
 *  - só se anima transform, opacity, clip-path e stroke-dashoffset.
 *  - prefers-reduced-motion desliga tudo, inclusive a linha e o Lenis.
 *  - nada é preso numa tela onde a seção não caiba: seria conteúdo cortado.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  if (!window.gsap || !window.ScrollTrigger) return;

  window.__zAnim = true;
  gsap.registerPlugin(ScrollTrigger);

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.remove('js');
    return;
  }

  var EASE = 'expo.out';
  var main = document.querySelector('main');
  var svg = document.querySelector('.thread');
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ------------------------------------------------------------------ *
   * Lenis: inércia no scroll. O ticker do GSAP passa a ser o relógio dos
   * dois, senão Lenis e ScrollTrigger andam em rAFs diferentes e o
   * conteúdo preso treme.
   * ------------------------------------------------------------------ */
  var lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);

    // âncoras internas precisam passar pelo Lenis, senão o scroll nativo
    // e a inércia disputam a mesma posição
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

  /* ------------------------------------------------------------------ *
   * A linha: costura vertical desenhada conforme o scroll.
   * A geometria é medida do DOM e refeita a cada refresh do ScrollTrigger,
   * porque os `pin` inserem espaçadores que mudam todas as posições.
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
      marks: [],
      y0: 0, y1: 0, len: 0, p: 0
    };
    th.segs.forEach(function (s) { svg.appendChild(s); });
    svg.appendChild(th.draw);

    [['#s-sinais'], ['#s-como'], ['#trabalhos']].forEach(function (pair) {
      var sec = document.querySelector(pair[0]);
      if (!sec) return;
      var m = { sec: sec, dot: node('circle', { r: 6 }, 'th-node'), tick: node('path', {}, 'th-tick') };
      m.tick.style.opacity = 0;
      svg.appendChild(m.dot);
      svg.appendChild(m.tick);
      th.marks.push(m);
    });
    svg.appendChild(th.head);
  }

  // Posição no documento levando em conta o espaçador que o `pin` cria:
  // o espaçador continua no fluxo, a seção presa não.
  function outer(el) {
    return (el.parentElement && el.parentElement.classList.contains('pin-spacer')) ? el.parentElement : el;
  }
  function docTop(el) {
    var o = outer(el);
    return o.getBoundingClientRect().top + window.scrollY - th.mainTop;
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

    // x na metade da margem esquerda, com piso para telas estreitas: a
    // linha nunca encosta no texto, em nenhuma largura
    var wrapEl = document.querySelector('.hero .wrap');
    var gutter = wrapEl.getBoundingClientRect().left - main.getBoundingClientRect().left;
    var x = Math.min(90, Math.max(7, gutter / 2));
    var comTick = gutter >= 60;

    var y0 = docTop(hero) + outer(hero).offsetHeight - 20;
    var y1 = docTop(close) - 20;   // termina onde o âmbar começa: âmbar sobre âmbar sumiria
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
      var noEscuro = y >= dTop && y <= dBot;
      m.y = y;
      m.dot.setAttribute('cx', x);
      m.dot.setAttribute('cy', y);
      m.dot.setAttribute('class', 'th-node' + (noEscuro ? ' on-dark' : ''));
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

  /* ------------------------------------------------------------------ *
   * Entrada do hero: acontece no load, vale em qualquer largura.
   * ------------------------------------------------------------------ */
  gsap.timeline({ defaults: { ease: EASE, duration: 0.9 } })
    .fromTo('.hero h1 .l', { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.09 }, 0)
    .fromTo('.hero .lead', { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, 0.22)
    .fromTo('.hero-actions', { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, 0.32)
    .fromTo('.figure', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, 0.16);

  /* parallax do papel milimetrado, em todas as larguras */
  gsap.to('.grid-layer', {
    y: function () { return window.innerHeight * 0.16; },
    ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true }
  });

  /* ------------------------------------------------------------------ *
   * Revelações comuns às duas larguras.
   * ------------------------------------------------------------------ */
  function whenIn(trigger, fn, start) {
    ScrollTrigger.create({ trigger: trigger, start: start || 'top 78%', once: true, onEnter: fn });
  }

  ['#s-sinais', '#s-como'].forEach(function (sel) {
    whenIn(sel, function () {
      gsap.fromTo(sel + ' [data-anim]:not(li):not(.step)', { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.85, ease: EASE, stagger: 0.1 });
    });
  });

  // sinais: a linha sobe e o traço âmbar é riscado, item por item
  whenIn('.spec', function () {
    gsap.fromTo('.spec li', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: EASE, stagger: 0.075 });
    gsap.fromTo('.spec .tick', { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: EASE, stagger: 0.075, delay: 0.12 });
  });

  // etapas: entram na ordem e os números contam — é uma sequência de verdade
  whenIn('.steps', function () {
    gsap.fromTo('.step', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.14 });
    document.querySelectorAll('.step .num').forEach(function (el, i) {
      countTo(el, parseInt(el.dataset.count, 10), 0.25 + i * 0.14);
    });
  });

  // fechamento: o âmbar inunda de baixo para cima.
  // O clip-path vira `none` no fim de propósito: com clearProps a regra
  // `[data-wipe]` do CSS voltaria a valer e esconderia a seção de novo.
  whenIn('#s-close', function () {
    gsap.fromTo('#s-close', { clipPath: 'inset(100% 0% 0% 0%)' }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: EASE,
      onComplete: function () { this.targets()[0].style.clipPath = 'none'; }
    });
    gsap.fromTo('#s-close [data-anim]', { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.1, delay: 0.3 });
  });

  function countTo(el, to, delay) {
    if (!el || isNaN(to)) return;
    var o = { v: 0 };
    gsap.to(o, {
      v: to, duration: 1.1, delay: delay || 0, ease: 'power2.out',
      onUpdate: function () { el.textContent = String(Math.round(o.v)).padStart(2, '0'); }
    });
  }
  var c24 = document.getElementById('count-24');

  /* ------------------------------------------------------------------ *
   * Pin + scrub. Só onde a seção cabe na tela — prender algo mais alto que
   * o viewport corta conteúdo, que é o pecado clássico desta técnica.
   * O matchMedia do GSAP desfaz tudo sozinho ao trocar de faixa.
   * ------------------------------------------------------------------ */
  var mm = gsap.matchMedia();

  mm.add('(min-width: 900px)', function () {
    var hero = document.querySelector('#s-hero');
    var dg = document.querySelector('.dg');
    var stops = gsap.utils.toArray('.dg .stop');
    var par = null;

    // --- o circuito se traça sob o dedo, parada por parada ---
    if (hero && dg && hero.offsetHeight <= window.innerHeight * 1.05) {
      var build = dg.querySelector('.build');
      var len = build.getTotalLength();
      gsap.set(build, { strokeDasharray: len, strokeDashoffset: len });

      // fração de cada parada ao longo do traçado, medida do próprio path
      var fr = [0.117, 0.367, 0.617, 0.867];
      var fim = 0.88;

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: hero, start: 'top top', end: '+=120%',
          pin: true, pinSpacing: true, scrub: 0.5, anticipatePin: 1,
          invalidateOnRefresh: true
        }
      });
      tl.to(build, { strokeDashoffset: 0, ease: 'none', duration: fim }, 0);
      stops.forEach(function (g, i) {
        tl.fromTo(g, { opacity: 0, scale: 0.9, transformOrigin: 'center' },
          { opacity: 1, scale: 1, ease: 'none', duration: 0.05 }, fr[i] * fim);
      });
      tl.to('.dg .dg-core', { opacity: 1, ease: 'none', duration: 0.06 }, 0.90)
        // montado, o circuito entrega o traço ao ciclo que roda sozinho
        .to('.dg .pulse', { opacity: 1, ease: 'none', duration: 0.05 }, 0.94)
        .to(build, { opacity: 0, ease: 'none', duration: 0.05 }, 0.95);

      if (c24) {
        ScrollTrigger.create({ trigger: hero, start: 'top top', once: true, onEnter: function () { countTo(c24, 24, 0.2); } });
      }
      par = null;   // não se faz parallax do que está preso: brigaria com a montagem
    } else {
      // não coube: mostra o diagrama pronto em vez de prender e cortar
      gsap.set('.dg .stop, .dg .pulse, .dg .dg-core', { opacity: 1 });
      gsap.set('.dg .build', { opacity: 0 });
      if (c24) countTo(c24, 24, 0.9);
      par = gsap.to('.figure .dg', {
        y: -70, ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.4 }
      });
    }

    // --- trabalhos: a faixa preta prende e os sistemas entram um a um ---
    var dark = document.querySelector('#trabalhos');
    if (dark && dark.offsetHeight <= window.innerHeight) {
      var t2 = gsap.timeline({
        scrollTrigger: {
          trigger: dark, start: 'top top', end: '+=110%',
          pin: true, pinSpacing: true, scrub: 0.5, anticipatePin: 1,
          invalidateOnRefresh: true
        }
      });
      t2.fromTo('#trabalhos [data-anim]:not(li)', { y: 20, opacity: 0 },
        { y: 0, opacity: 1, ease: 'none', duration: 0.08, stagger: 0.04 }, 0);
      gsap.utils.toArray('#trabalhos .work li').forEach(function (li, i) {
        t2.fromTo(li, { y: 26, opacity: 0 }, { y: 0, opacity: 1, ease: 'none', duration: 0.09 }, 0.16 + i * 0.16);
      });
    } else {
      whenIn('#trabalhos', function () {
        gsap.fromTo('#trabalhos [data-anim]', { y: 22, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.09 });
      }, 'top 72%');
    }

    return function () { if (par) par.kill(); };
  });

  mm.add('(max-width: 899px)', function () {
    // sem pin: o diagrama já nasce montado (o CSS não esconde nada abaixo
    // de 900px) e a faixa de trabalhos entra por revelação simples
    if (c24) countTo(c24, 24, 0.9);
    whenIn('#trabalhos', function () {
      gsap.fromTo('#trabalhos [data-anim]', { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.09 });
    }, 'top 72%');
  });

  /* ------------------------------------------------------------------ *
   * Remedição: os `pin` inserem espaçadores, então a linha só pode ser
   * posicionada depois que o ScrollTrigger termina de calcular tudo.
   * ------------------------------------------------------------------ */
  ScrollTrigger.addEventListener('refresh', layoutThread);
  layoutThread();
  ScrollTrigger.refresh();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
})();
