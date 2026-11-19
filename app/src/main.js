// Cover Studio editor wiring: owns the state, binds every control to it, and
// re-renders the live preview through window.CoverArt (implemented in cover.js).
// Classic script on purpose: it must run after src/cover.js, in that order.

(function () {
  'use strict';

  var preview = document.getElementById('preview');
  var statusEl = document.getElementById('status');
  var photoInput = document.getElementById('photo-input');
  var dropZone = document.getElementById('drop-zone');
  var photoList = document.getElementById('photo-list');
  var captionText = document.getElementById('caption-text');
  var captionSize = document.getElementById('caption-size');
  var captionY = document.getElementById('caption-y');
  var captionColor = document.getElementById('caption-color');

  var state = null;
  var engine = null;

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function render() {
    if (!engine || !state) return;
    try {
      engine.render(state, preview);
    } catch (err) {
      setStatus('Preview failed: ' + (err && err.message ? err.message : err));
    }
  }

  // Rebuilds the three panel photo selects from state.photos, keeping each
  // panel's current choice when that photo still exists.
  function refreshPhotoSelects() {
    for (var i = 0; i < 3; i++) {
      var select = document.getElementById('panel-photo-' + i);
      var previous = select.value;
      select.innerHTML = '';
      if (state.photos.length === 0) {
        var empty = document.createElement('option');
        empty.value = '';
        empty.textContent = 'No photos yet';
        select.appendChild(empty);
        state.panels[i].photo = 0;
        continue;
      }
      state.photos.forEach(function (photo, idx) {
        var option = document.createElement('option');
        option.value = String(idx);
        option.textContent = (idx + 1) + '. ' + photo.name;
        select.appendChild(option);
      });
      var wanted = previous === '' ? state.panels[i].photo : Number(previous);
      if (!Number.isFinite(wanted) || wanted < 0 || wanted >= state.photos.length) {
        wanted = 0;
      }
      state.panels[i].photo = wanted;
      select.value = String(wanted);
    }
    photoList.innerHTML = '';
    state.photos.forEach(function (photo, idx) {
      var li = document.createElement('li');
      li.textContent = (idx + 1) + '. ' + photo.name;
      photoList.appendChild(li);
    });
  }

  function addPhoto(photo) {
    state.photos.push(photo);
    refreshPhotoSelects();
    render();
    setStatus('Added photo: ' + photo.name + ' (' + state.photos.length + ' loaded)');
  }

  function loadFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    if (files.length === 0) return;
    files.forEach(function (file) {
      engine.loadPhotoFile(file).then(addPhoto, function (err) {
        setStatus('Could not load ' + file.name + ': ' + (err && err.message ? err.message : err));
      });
    });
  }

  function loadSampleFile(url, label) {
    setStatus('Loading sample photo…');
    engine.loadSample(url).then(function (photo) {
      addPhoto(photo);
    }, function (err) {
      setStatus('Could not load sample ' + label + ': ' + (err && err.message ? err.message : err));
    });
  }

  function bindPanelControls(i) {
    var photoSelect = document.getElementById('panel-photo-' + i);
    var zoom = document.getElementById('panel-zoom-' + i);
    var panX = document.getElementById('panel-panx-' + i);
    var panY = document.getElementById('panel-pany-' + i);

    photoSelect.addEventListener('change', function () {
      state.panels[i].photo = Number(photoSelect.value) || 0;
      render();
    });
    zoom.addEventListener('input', function () {
      state.panels[i].zoom = Number(zoom.value);
      render();
    });
    panX.addEventListener('input', function () {
      state.panels[i].panX = Number(panX.value);
      render();
    });
    panY.addEventListener('input', function () {
      state.panels[i].panY = Number(panY.value);
      render();
    });
  }

  function bindCaptionControls() {
    captionText.addEventListener('input', function () {
      state.caption.text = captionText.value;
      render();
    });
    captionSize.addEventListener('input', function () {
      state.caption.size = Number(captionSize.value);
      render();
    });
    captionY.addEventListener('input', function () {
      state.caption.y = Number(captionY.value);
      render();
    });
    captionColor.addEventListener('input', function () {
      state.caption.color = captionColor.value;
      render();
    });
  }

  function bindExport(buttonId, width, height, filename) {
    var button = document.getElementById(buttonId);
    button.addEventListener('click', function () {
      button.disabled = true;
      setStatus('Exporting ' + width + 'x' + height + ' PNG…');
      engine.exportPNG(state, width, height).then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        setStatus('Exported ' + width + 'x' + height + ' PNG');
      }, function (err) {
        setStatus('Export failed: ' + (err && err.message ? err.message : err));
      }).then(function () {
        button.disabled = false;
      });
    });
  }

  function bindUploads() {
    photoInput.addEventListener('change', function () {
      loadFiles(photoInput.files);
      photoInput.value = '';
    });

    dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropZone.classList.add('dragging');
    });
    dropZone.addEventListener('dragleave', function () {
      dropZone.classList.remove('dragging');
    });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.classList.remove('dragging');
      loadFiles(e.dataTransfer.files);
    });

    document.getElementById('btn-sample-boulevard').addEventListener('click', function () {
      loadSampleFile('samples/boulevard.jpg', 'Boulevard');
    });
    document.getElementById('btn-sample-pier').addEventListener('click', function () {
      loadSampleFile('samples/pier.jpg', 'Pier');
    });
  }

  function init() {
    engine = window.CoverArt;
    state = engine.createDefaultState();

    // Sync the controls with the default caption.
    captionText.value = state.caption.text;
    captionSize.value = String(state.caption.size);
    captionY.value = String(state.caption.y);
    captionColor.value = state.caption.color || '#ffffff';

    for (var i = 0; i < 3; i++) bindPanelControls(i);
    bindCaptionControls();
    bindUploads();
    bindExport('btn-export-1080', 1080, 1080, 'cover-1080.png');
    bindExport('btn-export-1350', 1080, 1350, 'cover-1350.png');
    bindExport('btn-export-1920', 1920, 1080, 'cover-1920.png');

    refreshPhotoSelects();
    render();

    // Re-render once the display font is ready so the caption uses Anton.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(render);
    }

    // Auto-load the boulevard sample so the preview is never empty.
    loadSampleFile('samples/boulevard.jpg', 'Boulevard');
  }

  // cover.js is written by a parallel worker, so tolerate it landing a moment
  // after this script runs: wait briefly, then report honestly if it is absent.
  function waitForEngine(attemptsLeft) {
    if (window.CoverArt && typeof window.CoverArt.createDefaultState === 'function') {
      init();
      return;
    }
    if (attemptsLeft <= 0) {
      setStatus('Cover engine (src/cover.js) did not load. Check the console and reload.');
      return;
    }
    setTimeout(function () { waitForEngine(attemptsLeft - 1); }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { waitForEngine(25); });
  } else {
    waitForEngine(25);
  }
})();
