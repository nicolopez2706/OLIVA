/* ============================================================
   OLIVA ENSALADAS · Lógica (menú, carrito, pedido por WhatsApp)
   ============================================================ */
(function () {
  'use strict';

  var C = window.OLIVA_CONFIG;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  var fmt = function (n) { return money.format(n); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- Storage seguro ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* modo privado */ } }
  };

  /* ---------- Estado ---------- */
  var products = {};
  C.products.forEach(function (p) { products[p.id] = p; });
  var cart = store.get('oliva.cart', []).filter(function (l) { return products[l.id]; });
  var sheetState = null; // { product, choices, qty }
  var lastFocus = null;
  var toastTimer = null;

  /* ---------- Helpers de precio / opciones ---------- */
  function optionList(group, choice) {
    if (!choice) return [];
    var names = Array.isArray(choice) ? choice : [choice];
    return group.options.filter(function (o) { return names.indexOf(o.label) !== -1; });
  }
  function unitPrice(p, choices) {
    if (typeof p.price !== 'number') return null;
    var total = p.price;
    p.groups.forEach(function (g) {
      optionList(g, choices[g.id]).forEach(function (o) { total += o.price || 0; });
    });
    return total;
  }
  function summary(p, choices) {
    var parts = [];
    p.groups.forEach(function (g) {
      var sel = optionList(g, choices[g.id]);
      if (!sel.length) return;
      var label = g.id === 'salsitas' ? 'Salsitas' : g.label;
      parts.push(label + ': ' + sel.map(function (o) { return o.short || o.label; }).join(', '));
    });
    return parts.join(' · ');
  }
  function defaultChoices(p) {
    var c = {};
    p.groups.forEach(function (g) {
      if (g.type === 'single') c[g.id] = g.options[0].label;
      else c[g.id] = [];
    });
    return c;
  }
  function lineKey(id, choices) { return id + '|' + JSON.stringify(choices); }

  /* ---------- WhatsApp ---------- */
  function waNumber() { return String(C.whatsapp || '').replace(/\D/g, ''); }
  function waUrl(text) {
    var n = waNumber();
    if (!n) return null;
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(text);
  }

  /* ---------- Toast ---------- */
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  /* ---------- Menú ---------- */
  function renderMenu() {
    $('#menuGrid').innerHTML = C.products.map(function (p) {
      var price = typeof p.price === 'number'
        ? '<span class="price">' + fmt(p.price) + '</span>'
        : '<span class="price ask">Consultá el precio</span>';
      return '<article class="card reveal" data-open="' + esc(p.id) + '" tabindex="0" role="button" aria-label="Personalizar ' + esc(p.name) + '">' +
        '<div class="card-img"><img src="' + esc(p.image) + '" width="800" height="800" loading="lazy" alt="' + esc(p.alt) + '"></div>' +
        '<div class="card-body"><h3>' + esc(p.name) + '</h3>' +
        '<p class="tagline">' + esc(p.tagline) + '</p>' +
        '<p class="desc">' + esc(p.description) + '</p>' +
        '<div class="card-foot">' + price +
        '<span class="add"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg> Elegir</span></div></div>' +
        '</article>';
    }).join('');
    observeReveal();
  }

  /* ---------- Overlays (sheet y drawer) ---------- */
  function lock(open) {
    var scrim = $('#scrim');
    if (open) {
      scrim.hidden = false;
      requestAnimationFrame(function () { scrim.classList.add('show'); });
      document.body.classList.add('no-scroll');
    } else {
      scrim.classList.remove('show');
      document.body.classList.remove('no-scroll');
      setTimeout(function () { if (!$('.sheet.open') && !$('.drawer.open')) scrim.hidden = true; }, 300);
    }
  }
  function openOverlay(el) {
    lastFocus = document.activeElement;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    lock(true);
    updateSticky();
    setTimeout(function () { var f = $('[data-close]', el) || el; f.focus({ preventScroll: true }); }, 60);
  }
  function closeOverlays() {
    var any = false;
    $$('.sheet.open, .drawer.open').forEach(function (el) {
      el.classList.remove('open');
      el.setAttribute('aria-hidden', 'true');
      any = true;
    });
    if (any) {
      lock(false);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      updateSticky();
    }
  }

  /* ---------- Sheet: personalizar ---------- */
  function groupHTML(g, sel) {
    var type = g.type === 'multi' ? 'checkbox' : 'radio';
    var opts = g.options.map(function (o) {
      var checked = g.type === 'multi' ? (sel[g.id] || []).indexOf(o.label) !== -1 : sel[g.id] === o.label;
      return '<label class="chip"><input type="' + type + '" name="g-' + esc(g.id) + '" value="' + esc(o.label) + '"' + (checked ? ' checked' : '') + '>' +
        '<span>' + esc(o.label) +
        (o.tag ? ' <em class="tag">' + esc(o.tag) + '</em>' : '') +
        (o.price ? ' <small>+' + fmt(o.price) + '</small>' : '') + '</span></label>';
    }).join('');
    return '<fieldset class="opt-group" data-group="' + esc(g.id) + '"><legend>' + esc(g.label) +
      (g.required ? '' : ' <span class="opt">(opcional)</span>') + '</legend><div class="chips">' + opts + '</div></fieldset>';
  }

  function openSheet(id) {
    var p = products[id];
    if (!p) return;
    sheetState = { product: p, choices: defaultChoices(p), qty: 1 };
    $('#sheetBody').innerHTML =
      '<div class="sheet-img"><img src="' + esc(p.image) + '" alt="' + esc(p.alt) + '"></div>' +
      '<div class="sheet-info"><h2 id="sheetTitle">' + esc(p.name) + '</h2>' +
      '<p class="tagline">' + esc(p.tagline) + '</p><p class="desc">' + esc(p.description) + '</p></div>' +
      '<div class="opts">' + p.groups.map(function (g) { return groupHTML(g, sheetState.choices); }).join('') + '</div>';
    updateSheetFooter();
    openOverlay($('#sheet'));
  }

  function readChoices() {
    var p = sheetState.product, c = {};
    p.groups.forEach(function (g) {
      var checked = $$('input[name="g-' + g.id + '"]:checked', $('#sheetBody')).map(function (i) { return i.value; });
      c[g.id] = g.type === 'multi' ? checked : (checked[0] || g.options[0].label);
    });
    sheetState.choices = c;
  }

  function updateSheetFooter() {
    var s = sheetState;
    $('#qtyVal').textContent = s.qty;
    var u = unitPrice(s.product, s.choices);
    $('#addBtn').textContent = u !== null ? 'Agregar · ' + fmt(u * s.qty) : 'Agregar al pedido';
  }

  function addFromSheet() {
    var s = sheetState;
    if (!s) return;
    var key = lineKey(s.product.id, s.choices);
    var found = cart.filter(function (l) { return l.key === key; })[0];
    if (found) found.qty = Math.min(20, found.qty + s.qty);
    else cart.push({ key: key, id: s.product.id, choices: s.choices, qty: s.qty });
    saveCart();
    closeOverlays();
    toast('Agregaste ' + s.qty + ' × ' + s.product.name);
    bumpCount();
  }

  /* ---------- Carrito ---------- */
  function saveCart() {
    store.set('oliva.cart', cart);
    renderCart();
  }
  function cartCount() { return cart.reduce(function (n, l) { return n + l.qty; }, 0); }
  function cartTotal() {
    var total = 0;
    for (var i = 0; i < cart.length; i++) {
      var u = unitPrice(products[cart[i].id], cart[i].choices);
      if (u === null) return null;
      total += u * cart[i].qty;
    }
    return total;
  }
  function bumpCount() {
    var c = $('#cartCount');
    c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
  }

  function renderCart() {
    var n = cartCount();
    var badge = $('#cartCount');
    badge.textContent = n;
    badge.hidden = n === 0;

    $('#cartEmpty').hidden = n > 0;
    $('#cartFilled').hidden = n === 0;
    $('#cartFoot').hidden = n === 0;

    $('#cartLines').innerHTML = cart.map(function (l, i) {
      var p = products[l.id];
      var u = unitPrice(p, l.choices);
      var sum = summary(p, l.choices);
      return '<li class="line" data-i="' + i + '">' +
        '<img src="' + esc(p.image) + '" alt="">' +
        '<div><h4>' + esc(p.name) + '</h4>' +
        (sum ? '<p class="meta">' + esc(sum) + '</p>' : '') +
        (u !== null ? '<p class="lp">' + fmt(u * l.qty) + '</p>' : '') +
        '<div class="qty"><button type="button" data-act="dec" aria-label="Menos"><svg class="ico" aria-hidden="true"><use href="#i-minus"/></svg></button>' +
        '<output>' + l.qty + '</output>' +
        '<button type="button" data-act="inc" aria-label="Más"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></button></div></div>' +
        '<button class="rm" type="button" data-act="rm" aria-label="Quitar ' + esc(p.name) + '"><svg class="ico" aria-hidden="true"><use href="#i-trash"/></svg></button>' +
        '</li>';
    }).join('');

    var total = cartTotal();
    $('#cartTotal').textContent = total === null ? 'A confirmar' : fmt(total);
    $('#totalHint').textContent = total === null
      ? 'Te confirmamos el total por WhatsApp junto con el costo de envío.'
      : 'El costo de envío se coordina por WhatsApp.';

    updateSticky();
    updateWaLink();
  }

  function updateSticky() {
    var n = cartCount();
    var bar = $('#stickyCart');
    var show = n > 0 && !$('.sheet.open') && !$('.drawer.open');
    bar.classList.toggle('show', show);
    bar.setAttribute('aria-hidden', show ? 'false' : 'true');
    bar.tabIndex = show ? 0 : -1;
    $('#stickyText').textContent = n + (n === 1 ? ' ensalada' : ' ensaladas');
    var t = cartTotal();
    $('#stickyTotal').textContent = n && t !== null ? fmt(t) : 'Ver pedido';
  }

  /* ---------- Mensaje de WhatsApp ---------- */
  function buildMessage() {
    var lines = ['¡Hola Oliva! 👋 Quiero hacer este pedido:', ''];
    cart.forEach(function (l) {
      var p = products[l.id], sum = summary(p, l.choices), u = unitPrice(p, l.choices);
      lines.push('• ' + l.qty + ' × *' + p.name + '*' + (u !== null ? ' — ' + fmt(u * l.qty) : ''));
      if (sum) lines.push('   ' + sum);
    });
    var t = cartTotal();
    if (t !== null) { lines.push('', '*Total:* ' + fmt(t)); }
    var name = $('#fName').value.trim(), addr = $('#fAddr').value.trim(), note = $('#fNote').value.trim();
    lines.push('', '*Nombre:* ' + name, '*Dirección:* ' + addr);
    if (note) lines.push('*Comentarios:* ' + note);
    lines.push('', '¡Gracias! 🥗');
    return lines.join('\n');
  }

  function updateWaLink() {
    var a = $('#waSend');
    var url = waUrl(buildMessage());
    a.href = url || '#';
  }

  function validate() {
    var ok = true;
    [['#fName', '#eName'], ['#fAddr', '#eAddr']].forEach(function (pair) {
      var input = $(pair[0]), err = $(pair[1]);
      var bad = input.value.trim().length < 2;
      input.closest('.field').classList.toggle('invalid', bad);
      input.setAttribute('aria-invalid', bad ? 'true' : 'false');
      err.hidden = !bad;
      if (bad && ok) { input.focus(); ok = false; }
    });
    return ok;
  }

  /* ---------- Formulario persistente ---------- */
  function loadForm() {
    var f = store.get('oliva.form', {});
    $('#fName').value = f.name || '';
    $('#fAddr').value = f.address || '';
    $('#fNote').value = f.note || '';
  }
  function saveForm() {
    store.set('oliva.form', { name: $('#fName').value, address: $('#fAddr').value, note: $('#fNote').value });
  }

  /* ---------- Reveal on scroll ---------- */
  var io = null;
  function observeReveal() {
    var els = $$('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    }
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------- Eventos ---------- */
  function bind() {
    // Abrir producto
    var grid = $('#menuGrid');
    grid.addEventListener('click', function (e) {
      var card = e.target.closest('[data-open]');
      if (card) openSheet(card.getAttribute('data-open'));
    });
    grid.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-open]')) {
        e.preventDefault(); openSheet(e.target.getAttribute('data-open'));
      }
    });

    // Sheet
    $('#sheetBody').addEventListener('change', function () { readChoices(); updateSheetFooter(); });
    $('#qtyMinus').addEventListener('click', function () { sheetState.qty = Math.max(1, sheetState.qty - 1); updateSheetFooter(); });
    $('#qtyPlus').addEventListener('click', function () { sheetState.qty = Math.min(20, sheetState.qty + 1); updateSheetFooter(); });
    $('#addBtn').addEventListener('click', addFromSheet);

    // Cerrar
    $('#scrim').addEventListener('click', closeOverlays);
    $$('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () {
        var goto = b.getAttribute('data-goto');
        closeOverlays();
        if (goto) { var t = $(goto); if (t) t.scrollIntoView({ behavior: 'smooth' }); }
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeOverlays();
      // trampa de foco simple dentro del overlay abierto
      if (e.key === 'Tab') {
        var o = $('.sheet.open') || $('.drawer.open');
        if (!o) return;
        var f = $$('button:not([disabled]), a[href], input, textarea, [tabindex]:not([tabindex="-1"])', o).filter(function (el) { return el.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Carrito
    $('#openCart').addEventListener('click', function () { openOverlay($('#cart')); });
    $('#stickyCart').addEventListener('click', function () { openOverlay($('#cart')); });
    $('#cartLines').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var i = +btn.closest('.line').getAttribute('data-i'), act = btn.getAttribute('data-act');
      if (act === 'inc') cart[i].qty = Math.min(20, cart[i].qty + 1);
      if (act === 'dec') cart[i].qty -= 1;
      if (act === 'rm' || cart[i].qty <= 0) cart.splice(i, 1);
      saveCart();
    });
    $('#clearCart').addEventListener('click', function () {
      if (window.confirm('¿Vaciar todo el pedido?')) { cart = []; saveCart(); }
    });

    // Formulario
    ['#fName', '#fAddr', '#fNote'].forEach(function (s) {
      $(s).addEventListener('input', function (e) {
        saveForm(); updateWaLink();
        var f = e.target.closest('.field');
        if (f && f.classList.contains('invalid') && e.target.value.trim().length >= 2) {
          f.classList.remove('invalid'); e.target.setAttribute('aria-invalid', 'false');
          var er = $('.err', f); if (er) er.hidden = true;
        }
      });
    });
    $('#orderForm').addEventListener('submit', function (e) { e.preventDefault(); });

    // Enviar por WhatsApp
    $('#waSend').addEventListener('click', function (e) {
      if (!cart.length) { e.preventDefault(); return; }
      if (!validate()) { e.preventDefault(); toast('Completá tu nombre y dirección'); return; }
      updateWaLink();
      if (!waNumber()) { e.preventDefault(); toast('Falta cargar el número de WhatsApp (assets/js/config.js)'); }
    });

    // Header con fondo al hacer scroll
    var header = $('.site-header'), ticking = false;
    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () { header.classList.toggle('scrolled', window.scrollY > 12); ticking = false; });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Links de WhatsApp genéricos ---------- */
  function initWaLinks() {
    var url = waUrl('¡Hola Oliva! Quería hacerles una consulta 🥗');
    $$('[data-wa]').forEach(function (a) {
      if (url) a.href = url; else a.hidden = true;
    });
  }

  /* ---------- Init ---------- */
  function init() {
    $('#year').textContent = new Date().getFullYear();
    renderMenu();
    loadForm();
    renderCart();
    initWaLinks();
    bind();
    observeReveal();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
