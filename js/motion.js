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
   * 4. Revelações presas ao scroll.
   *
   * Com `toggleActions` a animação rodava no relógio: disparava com a seção
   * ainda espiando no rodapé e acabava antes de você olhar para ela, e só
   * desfazia se o scroll voltasse todo o caminho até o ponto de disparo.
   * Com `scrub` a barra de progresso é a própria posição do scroll: descendo
   * monta, subindo desmonta, na velocidade do dedo.
   *
   * `ease: "none"` nos tweens de dentro pelo mesmo motivo — a curva quem faz
   * é o scroll. É o que os 835 `ease:"none"` do site do GTA VI indicavam.
   * ------------------------------------------------------------------ */
  function revela(trigger, monta, start, end) {
    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: trigger,
        // O que importa não é só onde começa e termina, é o quanto de scroll
        // fica no meio. Espalhado por ~700px, subindo a seção mal se desfazia
        // enquanto ainda estava à vista. Este trecho é curto (~390px) e fica
        // todo dentro da faixa em que a seção ocupa a tela: descendo ela se
        // monta ao entrar, subindo se desfaz enquanto você ainda a vê.
        start: start || 'top 65%',
        end: end || 'top 22%',
        scrub: 0.3   // menos atraso: subindo rápido, a desmontagem não fica para trás
      }
    });
    monta(tl);
    return tl;
  }

  // sinais: cada linha sobe e o traço âmbar é riscado, item por item, como
  // quem vai marcando uma lista enquanto desce a página
  revela('#s-sinais', function (tl) {
    tl.fromTo('#s-sinais [data-anim]:not(li)', { y: 26, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, stagger: 0.1 }, 0)
      .fromTo('.spec li', { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.22, stagger: 0.14 }, 0.18)
      .fromTo('.spec .tick', { scaleX: 0 },
        { scaleX: 1, duration: 0.18, stagger: 0.14 }, 0.26);
  });

  // etapas: entram na ordem e os números contam junto — subindo, contam de
  // volta para 00, porque vivem na mesma timeline presa ao scroll
  revela('#s-como', function (tl) {
    tl.fromTo('#s-como [data-anim]:not(.step)', { y: 26, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, stagger: 0.1 }, 0)
      .fromTo('.step', { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.26, stagger: 0.2 }, 0.2);
    document.querySelectorAll('.step .num').forEach(function (el, i) {
      var o = { v: 0 };
      tl.to(o, {
        v: parseInt(el.dataset.count, 10), duration: 0.3,
        onUpdate: function () { el.textContent = String(Math.round(o.v)).padStart(2, '0'); }
      }, 0.24 + i * 0.2);
    });
  });

  // Fechamento: o âmbar inunda de baixo para cima, e recua igual na volta.
  // Alcance próprio porque é a última seção — com o rodapé logo abaixo, o
  // topo dela nunca sobe até 18% da tela, e a animação nunca completaria.
  revela('#s-close', function (tl) {
    tl.fromTo('#s-close', { clipPath: 'inset(100% 0% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.55 }, 0)
      .fromTo('#s-close [data-anim]', { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, stagger: 0.14 }, 0.3);
  }, 'top 65%', 'bottom bottom');

  /* ------------------------------------------------------------------ *
   * Faixa de trabalhos.
   * ------------------------------------------------------------------ */
  // A faixa de trabalhos é mais alta que a maioria das telas, então ela não
  // pode ter um ritmo só, ancorado no próprio topo: quando o topo chegava à
  // marca, as últimas linhas ainda estavam abaixo da dobra e animavam fora do
  // campo de visão. Cada linha ganha o seu próprio trecho de scroll, medido
  // contra ela mesma — assim entra exatamente quando ELA aparece, em qualquer
  // altura de tela. (Foi por isso que o `pin` saiu: ele só engatava em telas
  // altas o bastante para a seção inteira caber, o que quase nunca acontece.)
  revela('#trabalhos', function (tl) {
    tl.fromTo('#trabalhos [data-anim]:not(li)', { y: 26, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.3, stagger: 0.12 }, 0);
  });

  gsap.utils.toArray('#trabalhos .work li').forEach(function (li) {
    gsap.fromTo(li, { y: 34, opacity: 0 }, {
      y: 0, opacity: 1, ease: 'none',
      scrollTrigger: { trigger: li, start: 'top 92%', end: 'top 64%', scrub: 0.3 }
    });
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

  // A abertura é CSS e avisa quando termina. Aqui só se retoma o que depende
  // do GSAP: soltar o Lenis e fazer o hero entrar.
  function depoisDaAbertura() {
    if (lenis) lenis.start();
    ScrollTrigger.refresh();
    heroEntra();
  }
  if (window.__introFim) depoisDaAbertura();
  else window.addEventListener('zentoo:intro', depoisDaAbertura, { once: true });
})();
