/* CoverArt — GTA 6 style multi-panel cover renderer.
 *
 * Classic script (no modules, no imports). Exposes `window.CoverArt` with:
 *   CoverArt.createDefaultState()
 *   CoverArt.render(state, canvas)
 *   CoverArt.exportPNG(state, width, height) -> Promise<Blob>
 *   CoverArt.loadPhotoFile(file)             -> Promise<{ name, img }>
 *   CoverArt.loadSample(url)                 -> Promise<{ name, img }>
 *
 * Layout (relative 0..1, thin 0.012 gaps, dark outer frame):
 *   panel 0 = top, full width,    y 0..0.56
 *   panel 1 = bottom-left,         x 0..0.5,  y 0.58..1
 *   panel 2 = bottom-right,        x 0.5..1,  y 0.58..1
 *
 * Per panel the photo is drawn COVER-FIT (fills the panel, no letterbox)
 * with zoom (1 = fit, higher = zoom in) and pan (0..1 = which part of the
 * photo is centred). Panels without a photo get a sunset placeholder.
 * A warm sunset/neon grade (orange -> magenta overlay), a vignette and a
 * slight contrast lift are applied over the photos; the caption is drawn
 * last so it stays crisp. No network requests at runtime: the only font
 * is the vendored Anton in ../fonts/.
 */
(function () {
  'use strict';

  var GAP = 0.012; // relative gap between panels
  var FONT_FAMILY = 'Anton';

  /** Panel rects in relative (0..1) coordinates. */
  function panelRects() {
    var g = GAP;
    return [
      { x: 0, y: 0, w: 1, h: 0.56 - g / 2 },
      { x: 0, y: 0.58 + g / 2, w: 0.5 - g / 2, h: 0.42 - g / 2 },
      { x: 0.5 + g / 2, y: 0.58 + g / 2, w: 0.5 - g / 2, h: 0.42 - g / 2 }
    ];
  }

  function createDefaultState() {
    return {
      photos: [],
      panels: [
        { photo: 0, zoom: 1, panX: 0.5, panY: 0.5 },
        { photo: 0, zoom: 1, panX: 0.5, panY: 0.5 },
        { photo: 0, zoom: 1, panX: 0.5, panY: 0.5 }
      ],
      caption: { text: 'VICE CITY', size: 1.0, color: '#FFFFFF', x: 0.5, y: 0.86 }
    };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  /** Sunset gradient placeholder for a panel with no photo yet. */
  function drawPlaceholder(ctx, x, y, w, h) {
    var grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, '#2b1055');
    grad.addColorStop(0.45, '#7597de');
    grad.addColorStop(0.62, '#ff7a18');
    grad.addColorStop(1, '#ff2d78');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Low sun disc.
    var cx = x + w * 0.5;
    var cy = y + h * 0.62;
    var r = Math.min(w, h) * 0.22;
    var sun = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    sun.addColorStop(0, 'rgba(255, 236, 170, 0.95)');
    sun.addColorStop(0.6, 'rgba(255, 150, 60, 0.85)');
    sun.addColorStop(1, 'rgba(255, 45, 120, 0)');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Dark skyline silhouette along the bottom of the panel.
    ctx.fillStyle = 'rgba(16, 8, 32, 0.55)';
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + h * 0.86);
    ctx.lineTo(x + w * 0.18, y + h * 0.86);
    ctx.lineTo(x + w * 0.18, y + h * 0.72);
    ctx.lineTo(x + w * 0.34, y + h * 0.72);
    ctx.lineTo(x + w * 0.34, y + h * 0.9);
    ctx.lineTo(x + w * 0.55, y + h * 0.9);
    ctx.lineTo(x + w * 0.55, y + h * 0.68);
    ctx.lineTo(x + w * 0.72, y + h * 0.68);
    ctx.lineTo(x + w * 0.72, y + h * 0.86);
    ctx.lineTo(x + w, y + h * 0.86);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  }

  /** Draw one photo cover-fit into a panel rect, honouring zoom/pan. */
  function drawPhotoCover(ctx, img, panel, x, y, w, h) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return false;

    var zoom = clamp(panel.zoom || 1, 1, 8);
    var panX = clamp(panel.panX == null ? 0.5 : panel.panX, 0, 1);
    var panY = clamp(panel.panY == null ? 0.5 : panel.panY, 0, 1);

    // Base cover scale (fills the panel), then the extra zoom.
    var scale = Math.max(w / iw, h / ih) * zoom;
    var sw = iw * scale;
    var sh = ih * scale;

    // pan 0 shows the left/top edge, pan 1 the right/bottom edge.
    var dx = x - panX * (sw - w);
    var dy = y - panY * (sh - h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, dx, dy, sw, sh);
    ctx.restore();
    return true;
  }

  /** Warm sunset/neon grade + vignette + slight contrast lift. */
  function applyGrade(ctx, w, h) {
    // Warm orange -> magenta wash, top to bottom, low alpha.
    var wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, '#ff7a18');
    wash.addColorStop(1, '#ff2d78');
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.10;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Subtle vignette: darkened corners, centre untouched.
    var vg = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.42,
      w / 2, h / 2, Math.max(w, h) * 0.75
    );
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(10, 4, 20, 0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    // Slight contrast/saturation lift (self-draw, guarded: not every
    // canvas implementation supports ctx.filter).
    try {
      ctx.save();
      ctx.filter = 'contrast(1.06) saturate(1.08)';
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.restore();
    } catch (e) {
      /* filter unsupported — the overlay grade above still applies. */
    }
  }

  /** The caption in vendored Anton, thick black outline + soft shadow. */
  function drawCaption(ctx, caption, w, h) {
    var text = (caption && caption.text != null) ? String(caption.text) : '';
    if (!text.trim()) return;

    var size = (caption.size || 1) * h * 0.16;
    var cx = (caption.x == null ? 0.5 : caption.x) * w;
    var cy = (caption.y == null ? 0.86 : caption.y) * h;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    // Shrink to fit so long captions never spill off the cover.
    var setFont = function (s) {
      ctx.font = s + 'px ' + FONT_FAMILY + ", 'Arial Black', sans-serif";
    };
    setFont(size);
    var maxW = w * 0.94;
    while (size > 12 && ctx.measureText(text).width > maxW) {
      size -= 2;
      setFont(size);
    }

    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.08;
    ctx.shadowOffsetY = size * 0.03;

    // Thick black outline: stroke several passes for a solid poster edge.
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(2, size / 12);
    ctx.strokeText(text, cx, cy);
    ctx.strokeText(text, cx, cy);
    ctx.strokeText(text, cx, cy);

    ctx.fillStyle = caption.color || '#FFFFFF';
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }

  /** Core synchronous draw: frame, panels, grade, caption. */
  function draw(state, canvas) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    if (!w || !h) return;
    state = state || createDefaultState();

    // Dark outer frame (also shows through the thin gaps).
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (typeof ctx.filter !== 'undefined') ctx.filter = 'none';
    ctx.fillStyle = '#0d0a14';
    ctx.fillRect(0, 0, w, h);

    var rects = panelRects();
    var photos = state.photos || [];
    var panels = state.panels || [];
    for (var i = 0; i < 3; i++) {
      var r = rects[i];
      var px = r.x * w, py = r.y * h, pw = r.w * w, ph = r.h * h;
      var panel = panels[i] || { photo: 0, zoom: 1, panX: 0.5, panY: 0.5 };
      var photo = photos[panel.photo];
      var drawn = false;
      if (photo && photo.img) drawn = drawPhotoCover(ctx, photo.img, panel, px, py, pw, ph);
      if (!drawn) drawPlaceholder(ctx, px, py, pw, ph);
    }

    applyGrade(ctx, w, h);
    drawCaption(ctx, state.caption || {}, w, h);
    ctx.restore();
  }

  /** Ask the browser to load Anton; resolves when it is usable (or not). */
  function ensureFont() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve(false);
    return document.fonts.load('100px ' + FONT_FAMILY)
      .then(function () { return document.fonts.check('100px ' + FONT_FAMILY); })
      .catch(function () { return false; });
  }

  function render(state, canvas) {
    draw(state, canvas);
    // If Anton was not loaded yet, the caption fell back to a sans font:
    // re-render once the font arrives so the poster gets the real lettering.
    if (document.fonts && !document.fonts.check('100px ' + FONT_FAMILY)) {
      if (!canvas.__coverArtFontPending) {
        canvas.__coverArtFontPending = true;
        document.fonts.ready.then(function () {
          canvas.__coverArtFontPending = false;
          if (document.fonts.check('100px ' + FONT_FAMILY)) draw(state, canvas);
        });
      }
    }
    return canvas;
  }

  function exportPNG(state, width, height) {
    return ensureFont().then(function () {
      if (document.fonts && document.fonts.ready) return document.fonts.ready;
      return null;
    }).then(function () {
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      draw(state, canvas);
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error('CoverArt.exportPNG: toBlob produced no blob'));
        }, 'image/png');
      });
    });
  }

  /** Load an image element from a URL, resolving once it can be drawn. */
  function loadImageElement(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('CoverArt: failed to load image ' + url)); };
      img.src = url;
    });
  }

  function loadPhotoFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        loadImageElement(reader.result).then(function (img) {
          resolve({ name: file.name || 'photo', img: img });
        }, reject);
      };
      reader.onerror = function () { reject(reader.error || new Error('CoverArt: failed to read file')); };
      reader.readAsDataURL(file);
    });
  }

  function loadSample(url) {
    var name = String(url).split('/').pop().split('?')[0] || 'sample';
    return loadImageElement(url).then(function (img) {
      return { name: name, img: img };
    });
  }

  window.CoverArt = {
    createDefaultState: createDefaultState,
    render: render,
    exportPNG: exportPNG,
    loadPhotoFile: loadPhotoFile,
    loadSample: loadSample
  };
})();
