/* Al Waad: cartoon avatars (drawn in code) and profile faces */
(function () {
  "use strict";
  const AW = (window.AW = window.AW || {});

  const BGS = ["#f6a607", "#2a59a2", "#7fb0f0", "#cd6216", "#ffe08a", "#3f7fd9", "#0f3d7a", "#071a38"];
  const SKINS = ["#ffdbb4", "#f1c27d", "#e0a872", "#c68642", "#8d5524", "#5c3a1e"];
  const HAIRS = ["#2b1b12", "#6b3f1d", "#d4a017", "#c0392b", "#7c5cff", "#2ec4b6", "#e9edf5"];
  const COUNTS = { hairStyle: 6, hairColor: 7, skin: 6, eyes: 5, mouth: 5, accessory: 9, bg: 8 };
  const CATS = ["hairStyle", "hairColor", "skin", "eyes", "mouth", "accessory", "bg"];
  const DEFAULT = { bg: 1, skin: 1, hairStyle: 1, hairColor: 0, eyes: 0, mouth: 0, accessory: 8 };

  function star(cx, cy) {
    const pts = [[0, -6], [1.8, -2], [6, -1.8], [2.8, 1], [3.8, 5.5], [0, 3], [-3.8, 5.5], [-2.8, 1], [-6, -1.8], [-1.8, -2]];
    return '<polygon points="' + pts.map(function (p) { return (cx + p[0]) + "," + (cy + p[1]); }).join(" ") + '" fill="#ffb800" stroke="#c27c00" stroke-width="1"/>';
  }

  function svg(cfg, size) {
    size = size || 64;
    const c = Object.assign({}, DEFAULT, cfg || {});
    const skin = SKINS[c.skin] || SKINS[0], hair = HAIRS[c.hairColor] || HAIRS[0], bg = BGS[c.bg] || BGS[0];
    let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" role="img" aria-hidden="true" class="av">';
    s += '<rect width="100" height="100" rx="22" fill="' + bg + '"/>';
    if (c.accessory === 5) s += '<path d="M26 40 L28 14 L44 28Z M74 40 L72 14 L56 28Z" fill="' + hair + '"/>';
    if (c.hairStyle === 3) s += '<path d="M20 60 Q18 22 50 22 Q82 22 80 60 L80 84 Q50 92 20 84Z" fill="' + hair + '"/>';
    s += '<path d="M16 100 Q18 80 50 80 Q82 80 84 100Z" fill="#fff" opacity=".92"/>';
    if (c.accessory === 8) {
      s += '<path d="M30 79 Q50 91 70 79 L62 96 L50 101 L38 96Z" fill="#f6a607" stroke="#b27500" stroke-width="2" stroke-linejoin="round"/>';
      s += '<circle cx="50" cy="90" r="3.2" fill="#2a59a2"/>';
    }
    s += '<circle cx="23" cy="54" r="5" fill="' + skin + '"/><circle cx="77" cy="54" r="5" fill="' + skin + '"/>';
    s += '<circle cx="50" cy="52" r="27" fill="' + skin + '"/>';
    s += '<circle cx="34" cy="62" r="5" fill="#ff6b8a" opacity=".28"/><circle cx="66" cy="62" r="5" fill="#ff6b8a" opacity=".28"/>';
    switch (c.hairStyle) {
      case 1: s += '<path d="M23 48 Q22 22 50 22 Q78 22 77 48 Q70 36 50 34 Q30 36 23 48Z" fill="' + hair + '"/>'; break;
      case 2: s += '<path d="M22 46 L26 24 L36 34 L44 18 L52 32 L62 18 L66 34 L76 24 L78 46 Q66 34 50 34 Q34 34 22 46Z" fill="' + hair + '"/>'; break;
      case 3: s += '<path d="M23 50 Q22 22 50 22 Q78 22 77 50 Q64 30 50 34 Q36 30 23 50Z" fill="' + hair + '"/>'; break;
      case 4: s += '<g fill="' + hair + '"><circle cx="30" cy="32" r="11"/><circle cx="44" cy="25" r="11"/><circle cx="58" cy="25" r="11"/><circle cx="71" cy="33" r="11"/><circle cx="24" cy="45" r="8"/><circle cx="77" cy="45" r="8"/></g>'; break;
      case 5: s += '<path d="M43 34 L45 9 Q50 3 55 9 L57 34Z" fill="' + hair + '"/>'; break;
    }
    const ink = 'stroke="#222" stroke-width="3" fill="none" stroke-linecap="round"';
    switch (c.eyes) {
      case 0: s += '<circle cx="40" cy="52" r="3.2" fill="#222"/><circle cx="60" cy="52" r="3.2" fill="#222"/>'; break;
      case 1: s += '<path d="M35 53 Q40 46 45 53" ' + ink + '/><path d="M55 53 Q60 46 65 53" ' + ink + '/>'; break;
      case 2: s += '<circle cx="40" cy="52" r="6.5" fill="#fff"/><circle cx="60" cy="52" r="6.5" fill="#fff"/><circle cx="41.5" cy="53" r="3.2" fill="#222"/><circle cx="61.5" cy="53" r="3.2" fill="#222"/>'; break;
      case 3: s += '<path d="M35 52 H45" ' + ink + '/><path d="M55 52 H65" ' + ink + '/>'; break;
      case 4: s += star(40, 52) + star(60, 52); break;
    }
    switch (c.mouth) {
      case 0: s += '<path d="M40 64 Q50 74 60 64" ' + ink + '/>'; break;
      case 1: s += '<path d="M38 63 Q50 79 62 63Z" fill="#fff" stroke="#222" stroke-width="2.5" stroke-linejoin="round"/>'; break;
      case 2: s += '<ellipse cx="50" cy="68" rx="6" ry="7" fill="#7a1f2b"/>'; break;
      case 3: s += '<path d="M42 67 H58" ' + ink + '/>'; break;
      case 4: s += '<path d="M46 68 Q50 80 54 68Z" fill="#ff6b8a"/><path d="M40 64 Q50 74 60 64" ' + ink + '/>'; break;
    }
    switch (c.accessory) {
      case 1: s += '<g fill="none" stroke="#222" stroke-width="2.5"><circle cx="40" cy="52" r="8.5"/><circle cx="60" cy="52" r="8.5"/><path d="M48.5 52 H51.5"/></g>'; break;
      case 2: s += '<g fill="#111"><rect x="30" y="46" width="19" height="12" rx="5"/><rect x="51" y="46" width="19" height="12" rx="5"/></g><path d="M49 51 H51" stroke="#111" stroke-width="2.5"/>'; break;
      case 3: s += '<path d="M31 30 L35 12 L43 22 L50 8 L57 22 L65 12 L69 30Z" fill="#ffd23f" stroke="#c99a00" stroke-width="2" stroke-linejoin="round"/>'; break;
      case 4: s += '<path d="M24 38 Q50 24 76 38" stroke="#ff5d8f" stroke-width="6" fill="none" stroke-linecap="round"/>'; break;
      case 6: s += '<path d="M50 3 L35 32 H65Z" fill="#3ee0b0" stroke="#17a07a" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="4" r="3.5" fill="#ff5d8f"/>'; break;
      case 7: s += '<ellipse cx="50" cy="30" rx="35" ry="8" fill="#8c6a2f"/><path d="M32 30 Q33 9 50 8 Q67 9 68 30 Q50 36 32 30Z" fill="#a88a45"/><path d="M33 26 Q50 32 67 26 L67 30 Q50 36 33 30Z" fill="#2a59a2"/>'; break;
    }
    return s + "</svg>";
  }

  // a profile's face: the real photo if they have one, otherwise the avatar
  function face(p, size) {
    size = size || 64;
    if (p && p.photo) {
      return '<img class="av ph" src="' + AW.esc(p.photo) + '" width="' + size + '" height="' + size + '" alt="" style="width:' + size + 'px;height:' + size + 'px">';
    }
    return svg(p && p.avatar, size);
  }

  // a small preview of one avatar piece (for the editor and the shop)
  function thumb(cat, idx, base, size) {
    size = size || 46;
    if (cat === "bg") return '<span class="sw" style="background:' + BGS[idx] + '"></span>';
    if (cat === "skin") return '<span class="sw" style="background:' + SKINS[idx] + '"></span>';
    if (cat === "hairColor") return '<span class="sw" style="background:' + HAIRS[idx] + '"></span>';
    const o = Object.assign({}, DEFAULT, base || {});
    o[cat] = idx;
    return svg(o, size);
  }

  // random starting look (used for the demo's other scouts)
  function random(seed) {
    let x = seed || Math.floor(Math.random() * 1e6);
    const r = function (n) { x = (x * 9301 + 49297) % 233280; return Math.floor((x / 233280) * n); };
    const a = {};
    CATS.forEach(function (k) { a[k] = r(COUNTS[k]); });
    return a;
  }

  AW.avatar = { BGS: BGS, SKINS: SKINS, HAIRS: HAIRS, COUNTS: COUNTS, CATS: CATS, DEFAULT: DEFAULT, svg: svg, face: face, thumb: thumb, random: random };
})();
