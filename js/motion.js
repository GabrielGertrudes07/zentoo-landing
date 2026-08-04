/* Camada de movimento da Zentoo.
 *
 * Regras que valem para tudo aqui:
 *  - o estado padrão da página é "visível". Os estados iniciais das animações
 *    vêm do CSS sob a classe `js`, e o script inline do <head> devolve tudo
 *    ao normal se este arquivo não rodar. Nada de conteúdo preso invisível.
 *  - só se anima transform, opacity, clip-path e stroke-dashoffset. Nenhuma
 *    propriedade que force recálculo de layout durante o scroll.
 *  - prefers-reduced-motion desliga tudo, inclusive a linha.
 */
(function () {
  'use strict';

  var root = document.documentElement;

  // Sem GSAP não há o que fazer: a rede de segurança do <head> revela a
  // página sozinha em 2s.
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

  function node(tag, attrs, cls) {
    var n = document.createElementNS(SVGNS, tag);
    if (cls) n.setAttribute('class', cls);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* ------------------------------------------------------------------ *
   * A linha: costura vertical desenhada conforme o scroll.
   * A geometria é medida do DOM real, então acompanha qualquer viewport.
   * ------------------------------------------------------------------ */
  var threadTweens = [];

  function buildThread() {
    threadTweens.forEach(function (t) { if (t.scrollTrigger) t.scrollTrigger.kill(); t.kill(); });
    threadTweens = [];
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var hero = document.querySelector('#s-hero');
    var dark = document.querySelector('#trabalhos');
    var close = document.querySelector('#s-close');
    if (!hero || !dark || !close) return;

    var W = main.offsetWidth;
    var H = main.offsetHeight;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);

    // x fica na metade da margem esquerda, com piso para telas estreitas —
    // assim a linha nunca encosta no texto, em nenhuma largura.
    var wrapEl = document.querySelector('.hero .wrap');
    var gutter = wrapEl.getBoundingClientRect().left - main.getBoundingClientRect().left;
    var x = Math.min(90, Math.max(7, gutter / 2));
    var ticks = gutter >= 60;

    var y0 = hero.offsetTop + hero.offsetHeight - 20;
    var yEnd = close.offsetTop - 20;
    // a linha para onde a faixa âmbar começa: âmbar sobre âmbar sumiria, e
    // terminar no CTA é o destino certo mesmo.
    if (yEnd <= y0) return;

    var dTop = dark.offsetTop;
    var dBot = dark.offsetTop + dark.offsetHeight;

    // trilha apagada em três trechos, porque sobre a faixa preta ela
    // precisa de um cinza mais claro para continuar visível
    function seg(a, b, onDark) {
      if (b <= a) return;
      svg.appendChild(node('path', { d: 'M' + x + ' ' + a + 'V' + b }, 'th-track' + (onDark ? ' on-dark' : '')));
    }
    seg(y0, Math.min(dTop, yEnd), false);
    seg(Math.max(dTop, y0), Math.min(dBot, yEnd), true);
    seg(Math.max(dBot, y0), yEnd, false);

    var draw = node('path', { d: 'M' + x + ' ' + y0 + 'V' + yEnd }, 'th-draw');
    svg.appendChild(draw);

    // um nó por seção, na altura do próprio título
    var marks = [];
    [['#s-sinais', 'h2'], ['#s-como', 'h2'], ['#trabalhos', 'h2']].forEach(function (pair) {
      var sec = document.querySelector(pair[0]);
      var h = sec && sec.querySelector(pair[1]);
      if (!h) return;
      var y = sec.offsetTop + h.offsetTop + h.offsetHeight / 2;
      if (y < y0 || y > yEnd) return;
      var onDark = y >= dTop && y <= dBot;
      var c = node('circle', { cx: x, cy: y, r: 6 }, 'th-node' + (onDark ? ' on-dark' : ''));
      svg.appendChild(c);
      var tick = null;
      if (ticks) {
        tick = node('path', { d: 'M' + (x + 10) + ' ' + y + 'h26' }, 'th-tick');
        tick.style.opacity = 0;
        svg.appendChild(tick);
      }
      marks.push({ sec: sec, dot: c, tick: tick });
    });

    var head = node('circle', { cx: x, cy: y0, r: 5 }, 'th-head');
    svg.appendChild(head);

    // desenho ligado ao scroll da página inteira
    var len = draw.getTotalLength();
    gsap.set(draw, { strokeDasharray: len, strokeDashoffset: len });
    threadTweens.push(gsap.to(draw, {
      strokeDashoffset: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: main, start: 'top top', end: 'bottom bottom', scrub: 0.6,
        onUpdate: function () {
          var p = 1 - gsap.getProperty(draw, 'strokeDashoffset') / len;
          gsap.set(head, { attr: { cy: y0 + (yEnd - y0) * p }, opacity: p > 0.005 && p < 0.995 ? 1 : 0 });
        }
      }
    }));

    // cada nó acende quando a sua seção chega, e apaga se voltar
    marks.forEach(function (m) {
      var st = ScrollTrigger.create({
        trigger: m.sec, start: 'top 70%', end: 'bottom 30%',
        onToggle: function (self) {
          gsap.to(m.dot, { attr: { r: self.isActive ? 8 : 6 }, fill: self.isActive ? 'var(--amber)' : '', duration: 0.4, ease: EASE });
          if (m.tick) gsap.to(m.tick, { opacity: self.isActive ? 1 : 0, duration: 0.4, ease: EASE });
        }
      });
      threadTweens.push({ kill: function () {}, scrollTrigger: st });
    });
  }

  /* ------------------------------------------------------------------ *
   * Entrada do hero: acontece no load, não no scroll.
   * ------------------------------------------------------------------ */
  gsap.timeline({ defaults: { ease: EASE, duration: 0.9 } })
    .fromTo('.hero h1 .l', { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.09 }, 0)
    .fromTo('.hero .lead', { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, 0.22)
    .fromTo('.hero-actions', { y: 20, opacity: 0 }, { y: 0, opacity: 1 }, 0.32)
    .fromTo('.figure', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, 0.16);

  /* ------------------------------------------------------------------ *
   * Parallax. O fundo milimetrado e o diagrama andam mais devagar que o
   * texto — só transform, então roda na thread de composição.
   * ------------------------------------------------------------------ */
  gsap.to('.grid-layer', {
    y: function () { return window.innerHeight * 0.16; },
    ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true }
  });

  // o parallax mira o SVG interno, não `.figure`, para não brigar com a
  // animação de entrada que já move `.figure`
  gsap.to('.figure .dg', {
    y: -70, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.4 }
  });

  /* ------------------------------------------------------------------ *
   * Revelação por seção. Cada uma entra do jeito que combina com ela,
   * em vez do mesmo fade-up repetido cinco vezes.
   * ------------------------------------------------------------------ */
  function whenIn(trigger, fn, start) {
    ScrollTrigger.create({ trigger: trigger, start: start || 'top 78%', once: true, onEnter: fn });
  }

  // títulos das seções claras
  ['#s-sinais', '#s-como'].forEach(function (sel) {
    whenIn(sel, function () {
      gsap.fromTo(sel + ' [data-anim]:not(li):not(.step)', { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.85, ease: EASE, stagger: 0.1 });
    });
  });

  // sinais: a linha sobe e o traço âmbar é riscado, item por item —
  // leitura de quem vai marcando uma lista
  whenIn('.spec', function () {
    gsap.fromTo('.spec li', { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: EASE, stagger: 0.075 });
    gsap.fromTo('.spec .tick', { scaleX: 0 },
      { scaleX: 1, duration: 0.5, ease: EASE, stagger: 0.075, delay: 0.12 });
  });

  // etapas: entram na ordem e os números contam — é uma sequência de verdade
  whenIn('.steps', function () {
    gsap.fromTo('.step', { y: 26, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.14 });
    document.querySelectorAll('.step .num').forEach(function (el, i) {
      countTo(el, parseInt(el.dataset.count, 10), 0.25 + i * 0.14);
    });
  });

  // Ao terminar a cortina o clip-path vira `none` explicitamente. Não dá
  // para usar clearProps aqui: sem estilo inline a regra `[data-wipe]` do
  // CSS volta a valer e esconderia a seção de novo.
  function wipe(sel, from) {
    gsap.fromTo(sel, { clipPath: from }, {
      clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: EASE,
      onComplete: function () { this.targets()[0].style.clipPath = 'none'; }
    });
  }

  // trabalhos: a faixa preta desce como cortina, depois as linhas entram
  whenIn('#trabalhos', function () {
    wipe('#trabalhos', 'inset(0% 0% 100% 0%)');
    gsap.fromTo('#trabalhos [data-anim]', { y: 22, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.09, delay: 0.35 });
  }, 'top 72%');

  // fechamento: o âmbar inunda de baixo para cima, na direção oposta
  whenIn('#s-close', function () {
    wipe('#s-close', 'inset(100% 0% 0% 0%)');
    gsap.fromTo('#s-close [data-anim]', { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: EASE, stagger: 0.1, delay: 0.3 });
  }, 'top 78%');

  /* ------------------------------------------------------------------ *
   * Contadores. Sempre com dois dígitos para o texto não mudar de largura
   * e tremer a cada quadro.
   * ------------------------------------------------------------------ */
  function countTo(el, to, delay) {
    if (!el || isNaN(to)) return;
    var o = { v: 0 };
    gsap.to(o, {
      v: to, duration: 1.1, delay: delay || 0, ease: 'power2.out',
      onUpdate: function () { el.textContent = String(Math.round(o.v)).padStart(2, '0'); }
    });
  }

  var c24 = document.getElementById('count-24');
  if (c24) countTo(c24, 24, 0.9);

  /* ------------------------------------------------------------------ *
   * Remedição. A linha é geometria medida, então precisa ser refeita
   * quando a fonte carrega ou o layout muda.
   * ------------------------------------------------------------------ */
  buildThread();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { buildThread(); ScrollTrigger.refresh(); });
  }

  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () { buildThread(); ScrollTrigger.refresh(); }, 180);
  });
})();
