(function() {
	//#region src/world/art/pen.ts
	function hex(c) {
		const n = parseInt(c.slice(1), 16);
		return [
			n >> 16 & 255,
			n >> 8 & 255,
			n & 255
		];
	}
	function hash(x, y, s) {
		let n = x * 73856093 ^ y * 19349663 ^ s * 83492791;
		n = Math.imul(n ^ n >>> 13, 1274126177);
		return ((n ^ n >>> 16) >>> 0) / 4294967296;
	}
	function noise(x, y, seed) {
		const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
		const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
		const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
		return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
	}
	function rng(seed) {
		let a = seed >>> 0;
		return () => {
			a = a + 1831565813 | 0;
			let t = Math.imul(a ^ a >>> 15, 1 | a);
			t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		};
	}
	function canvas(w, h) {
		const c = document.createElement("canvas");
		c.width = w;
		c.height = h;
		return c;
	}
	function sprite(w, h, fn) {
		const c = canvas(w, h), g = c.getContext("2d", { willReadFrequently: true });
		fn({
			w,
			h,
			g,
			p(x, y, col) {
				g.fillStyle = col;
				g.fillRect(x | 0, y | 0, 1, 1);
			},
			r(x, y, ww, hh, col) {
				g.fillStyle = col;
				g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));
			},
			disc(cx, cy, rad, col) {
				g.fillStyle = col;
				for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
					const dx = x + .5 - cx, dy = y + .5 - cy;
					if (dx * dx + dy * dy <= rad * rad) g.fillRect(x, y, 1, 1);
				}
			},
			ell(cx, cy, rx, ry, col) {
				g.fillStyle = col;
				for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
					const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry;
					if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
				}
			},
			outline(col) {
				const d = g.getImageData(0, 0, w, h), a = d.data, o = new Uint8Array(w * h), oc = hex(col);
				for (let i = 0; i < w * h; i++) o[i] = a[i * 4 + 3] > 0 ? 1 : 0;
				for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
					const i = y * w + x;
					if (o[i]) continue;
					if (x > 0 && o[i - 1] || x < w - 1 && o[i + 1] || y > 0 && o[i - w] || y < h - 1 && o[i + w]) {
						a[i * 4] = oc[0];
						a[i * 4 + 1] = oc[1];
						a[i * 4 + 2] = oc[2];
						a[i * 4 + 3] = 255;
					}
				}
				g.putImageData(d, 0, 0);
			}
		});
		return c;
	}
	/** Spiegelt ein Sprite waagerecht (rechte Ansicht aus der linken). */
	function mirror(src) {
		const c = canvas(src.width, src.height), g = c.getContext("2d");
		g.translate(c.width, 0);
		g.scale(-1, 1);
		g.drawImage(src, 0, 0);
		return c;
	}
	/** Zwischenspeicher für Sprites: ein Schlüssel je sichtbarem Zustand. */
	function memo(key, make) {
		const cache = /* @__PURE__ */ new Map();
		return (...a) => {
			const k = key(...a);
			let c = cache.get(k);
			if (!c) {
				c = make(...a);
				cache.set(k, c);
			}
			return c;
		};
	}
	//#endregion
	//#region src/world/art/palette.ts
	var WP = {
		outline: "#3b2c3d",
		grass1: "#97d66e",
		grass2: "#7ec35c",
		grass3: "#68ae52",
		grassDark: "#539848",
		grassLight: "#b2e47f",
		wild1: "#5f9f4c",
		wild2: "#4f8c45",
		wild3: "#437c40",
		path1: "#efdaa8",
		path2: "#e0c48e",
		path3: "#c8a777",
		pebble: "#b49a7b",
		cob1: "#ddd4c4",
		cob2: "#c6bba9",
		cob3: "#a59a88",
		cobHi: "#efe9dd",
		water1: "#86dbf0",
		water2: "#5cc2e3",
		water3: "#3fa4d3",
		waterDeep: "#2e86c0",
		foam: "#eafcff",
		soil1: "#9c6b47",
		soil2: "#83573a",
		wood1: "#cf9159",
		wood2: "#a96f42",
		wood3: "#7c4e30",
		roof1: "#e6775c",
		roof2: "#cc5f48",
		roof3: "#a2463a",
		wall1: "#f6e9cc",
		wall2: "#e5d2ad",
		wall3: "#cbb38c",
		leaf1: "#8ad868",
		leaf2: "#67bb55",
		leaf3: "#4a9f4b",
		leaf4: "#327d44",
		trunk1: "#a06c45",
		trunk2: "#764b30",
		fP: "#ff9fc2",
		fY: "#ffd94f",
		fW: "#fffaf0",
		fB: "#93baff",
		fR: "#ff6b6b",
		stone1: "#d2cbc0",
		stone2: "#aca499",
		stone3: "#888077",
		glass: "#a6dcf2",
		glassLit: "#ffd88a",
		lamp: "#fff2c6",
		lampLit: "#ffd36e",
		skin: "#f7cba2",
		hairA: "#7a4a2b",
		hairM: "#3d2a3c",
		shirtA: "#efa24b",
		pantsA: "#4f6c9c",
		dressM: "#7fc48f",
		dressM2: "#5ea873"
	};
	var WPA = Object.fromEntries(Object.entries(WP).map(([k, v]) => [k, hex(v)]));
	var T$1 = (skyTop, skyBot, haze, grade, lights, stars, glowA) => ({
		skyTop: hex(skyTop),
		skyBot: hex(skyBot),
		haze: hex(haze),
		grade: hex(grade),
		lights,
		stars,
		glowA
	});
	var TIMES = {
		Morgen: T$1("#a9cff2", "#ffe2cb", "#ffe8d6", "#fff1e4", 0, 0, 0),
		Mittag: T$1("#6cb7f3", "#cfefff", "#e2f4ff", "#ffffff", 0, 0, 0),
		Abend: T$1("#5d5ba8", "#ffab79", "#ffcaa2", "#ffd2ad", 1, 0, .42),
		Nacht: T$1("#0f1534", "#353b70", "#3b4378", "#6070b8", 1, 1, .75)
	};
	var css = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
	//#endregion
	//#region src/world/art/people.ts
	var LOOKS = {
		alex: {
			hair: WP.hairA,
			hairHi: "#9b6a44",
			top: WP.shirtA,
			topHi: "#ffc07a",
			topLo: "#c9802f",
			legs: WP.pantsA,
			shoes: "#5a3a2a",
			dress: false,
			longHair: false,
			accent: "#e8ac5c"
		},
		mira: {
			hair: WP.hairM,
			hairHi: "#5a4058",
			top: WP.dressM,
			topHi: "#a2dcae",
			topLo: WP.dressM2,
			legs: WP.skin,
			shoes: "#c95c6c",
			dress: true,
			longHair: true,
			clip: WP.fP,
			accent: "#93c79f"
		}
	};
	var TOPS = [
		[
			"#d9695a",
			"#f08a7c",
			"#a8473b"
		],
		[
			"#5a8fd9",
			"#86b2ef",
			"#3f68a8"
		],
		[
			"#b58ad9",
			"#d0aeee",
			"#8660a8"
		],
		[
			"#d9c25a",
			"#efdc86",
			"#a8943b"
		],
		[
			"#5ac2b5",
			"#88dcd2",
			"#3b9186"
		]
	];
	var HAIRS = [
		["#2a2420", "#4a413a"],
		["#8a5a2f", "#ad7a4a"],
		["#c9a55a", "#e6c88a"],
		["#7a3a2a", "#a05a45"]
	];
	var idHash = (s) => [...s].reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7);
	function lookOf(id) {
		if (LOOKS[id]) return LOOKS[id];
		const h = idHash(id), t = TOPS[h % TOPS.length], hr = HAIRS[(h >>> 3) % HAIRS.length], dress = (h >>> 6 & 1) === 1;
		return {
			hair: hr[0],
			hairHi: hr[1],
			top: t[0],
			topHi: t[1],
			topLo: t[2],
			legs: dress ? WP.skin : "#4a5568",
			shoes: "#5a3a2a",
			dress,
			longHair: dress,
			accent: t[0]
		};
	}
	var accentOf = (id) => lookOf(id).accent;
	var EYE = "#2a1f2b";
	var BLUSH = "#ffb0a8";
	var CX = 7.5;
	function legs(s, L, dir, frame, sit) {
		const top = L.dress ? 19 : 18;
		if (sit) {
			s.r(4, 20, 3, 1, L.legs);
			s.r(8, 20, 3, 1, L.legs);
			s.r(4, 21, 3, 1, L.shoes);
			s.r(8, 21, 3, 1, L.shoes);
			return;
		}
		if (dir === "left") {
			if (frame === "stand" || frame === 1 || frame === 3) {
				s.r(6, top, 3, 21 - top, L.legs);
				s.r(5, 21, 4, 1, L.shoes);
				return;
			}
			const [front, back] = frame === 0 ? [L.legs, L.topLo] : [L.topLo, L.legs];
			s.r(9, top, 2, 21 - top, L.dress ? L.legs : back);
			s.r(9, 21, 3, 1, L.shoes);
			s.r(4, top, 2, 21 - top, L.dress ? L.legs : front);
			s.r(3, 21, 3, 1, L.shoes);
			return;
		}
		const liftL = frame === 2 ? 1 : 0, liftR = frame === 0 ? 1 : 0;
		s.r(5, top, 2, 21 - top - liftL, L.legs);
		s.r(8, top, 2, 21 - top - liftR, L.legs);
		s.r(4, 21 - liftL, 3, 1, L.shoes);
		s.r(8, 21 - liftR, 3, 1, L.shoes);
	}
	function body(s, L, dir, b, swing) {
		const side = dir === "left";
		if (L.dress) for (let y = 0; y < 8; y++) {
			const hw = (side ? 2 : 3) + Math.floor(y / 3);
			s.r(CX - hw, 12 - b + y, hw * 2, 1, y < 2 ? L.top : y % 3 === 2 ? L.topLo : L.top);
		}
		else {
			s.r(side ? 5 : 4, 12 - b, side ? 5 : 7, 7, L.top);
			s.r(side ? 5 : 4, 12 - b, side ? 5 : 7, 1, L.topHi);
		}
		if (side) {
			s.r(7 - swing, 13 - b, 2, 3, L.topLo);
			s.p(7 - swing * 2, 16 - b, WP.skin);
			return;
		}
		const hl = L.dress ? 2 : 3, hr = L.dress ? 12 : 11;
		s.p(hl, 14 - b + swing, WP.skin);
		s.p(hr, 14 - b - swing, WP.skin);
	}
	function head(s, L, dir, b) {
		s.disc(CX, 7 - b, 5.4, WP.skin);
		if (dir === "down") {
			if (!L.longHair) {
				s.disc(CX, 4.5 - b, 5, L.hair);
				s.r(2, 4 - b, 11, 2, L.hair);
				s.p(3, 7 - b, L.hair);
				s.p(12, 7 - b, L.hair);
				s.p(6, 2 - b, L.hairHi);
			} else {
				s.disc(CX, 4.6 - b, 5.2, L.hair);
				s.r(2, 4 - b, 2, 9, L.hair);
				s.r(11, 4 - b, 2, 9, L.hair);
				s.r(4, 3 - b, 7, 2, L.hair);
			}
			if (L.clip) {
				s.p(10, 2 - b, L.clip);
				s.p(11, 3 - b, L.clip);
			}
			s.r(5, 8 - b, 1, 2, EYE);
			s.r(9, 8 - b, 1, 2, EYE);
			s.p(4, 10 - b, BLUSH);
			s.p(10, 10 - b, BLUSH);
			return;
		}
		if (dir === "up") {
			s.disc(CX, 6 - b, 5.5, L.hair);
			s.r(2, 4 - b, 11, 5, L.hair);
			s.p(6, 2 - b, L.hairHi);
			if (L.longHair) s.r(3, 8 - b, 9, 6, L.hair);
			if (L.clip) {
				s.p(4, 2 - b, L.clip);
				s.p(3, 3 - b, L.clip);
			}
			return;
		}
		s.disc(8.5, 4.6 - b, 5.1, L.hair);
		s.r(9, 4 - b, 4, L.longHair ? 9 : 5, L.hair);
		s.r(4, 3 - b, 6, 2, L.hair);
		if (!L.longHair) s.p(7, 2 - b, L.hairHi);
		if (L.clip) {
			s.p(11, 3 - b, L.clip);
			s.p(12, 4 - b, L.clip);
		}
		s.p(2, 8 - b, WP.skin);
		s.r(4, 8 - b, 1, 2, EYE);
		s.p(4, 10 - b, BLUSH);
	}
	function draw(id, dir, frame, pose = "") {
		if (dir === "right") return mirror(figure(id, "left", frame, pose));
		const L = lookOf(id), walk = frame !== "stand", b = walk && (frame === 1 || frame === 3) ? 1 : 0, sit = pose === "sit";
		const swing = !walk ? 0 : frame === 0 ? 1 : frame === 2 ? -1 : 0;
		return sprite(15, 23, (s) => {
			const off = sit ? 2 : 0;
			if (off) s.g.translate(0, off);
			legs(s, L, dir, frame, false);
			body(s, L, dir, b, swing);
			head(s, L, dir, b);
			if (off) {
				s.g.setTransform(1, 0, 0, 1, 0, 0);
				s.g.clearRect(0, 20, 15, 3);
				legs(s, L, dir, frame, true);
			}
			s.outline(WP.outline);
		});
	}
	/** Figur (15 × 23, Fußpunkt unten Mitte). */
	var figure = memo((id, dir, frame, pose = "") => `${id}|${dir}|${frame}|${pose}`, draw);
	/** Schlafende Figur im Bett: Kopf auf dem Kissen, Decke darüber; wird über das Bett gelegt. */
	var sleeper = memo((id) => id, (id) => {
		const L = lookOf(id);
		return sprite(16, 14, (s) => {
			s.disc(8, 5, 3.8, L.hair);
			s.ell(8, 7.2, 3, 2.2, WP.skin);
			s.r(6, 7, 1, 1, EYE);
			s.r(9, 7, 1, 1, EYE);
			if (L.longHair) {
				s.r(3, 4, 2, 6, L.hair);
				s.r(11, 4, 2, 6, L.hair);
			}
			s.r(1, 9, 14, 5, L.top);
			s.r(1, 9, 14, 1, L.topHi);
			s.outline(WP.outline);
		});
	});
	/** Werkzeuge in der Hand, im Stil des Mockups (Gießkanne 1:1 aus wPerson). */
	var tool = memo((name) => name, (name) => sprite(8, 8, (s) => {
		if (name === "can") {
			s.r(1, 2, 5, 4, "#6aa7da");
			s.r(5, 1, 2, 1, "#6aa7da");
			s.r(2, 1, 3, 1, "#4f86b8");
			s.p(7, 0, "#9fd0f5");
		} else if (name === "axe") {
			s.r(4, 1, 1, 7, WP.wood2);
			s.r(1, 1, 3, 3, WP.stone2);
			s.p(1, 1, WP.stone1);
		} else if (name === "hammer") {
			s.r(4, 2, 1, 6, WP.wood2);
			s.r(2, 0, 5, 2, WP.stone3);
		} else if (name === "shovel") {
			s.r(3, 0, 1, 5, WP.wood2);
			s.r(2, 5, 3, 3, WP.stone2);
		} else if (name === "book") {
			s.r(1, 2, 6, 5, "#b24a3a");
			s.r(2, 3, 4, 3, "#f2ece0");
		}
		s.outline(WP.outline);
	}));
	//#endregion
	//#region src/world/art/nature.ts
	function sunflower() {
		return sprite(11, 22, (s) => {
			s.r(5, 8, 1, 13, WP.leaf3);
			s.ell(3, 13, 2, 1, WP.leaf2);
			s.ell(8, 16, 2, 1, WP.leaf2);
			s.disc(5.5, 5.5, 4.5, WP.fY);
			s.disc(5.5, 5.5, 2.2, "#8a5a2b");
			s.p(4, 4, "#b07a3a");
			s.outline(WP.outline);
		});
	}
	function tomato(seed) {
		return sprite(13, 15, (s) => {
			let R = rng(seed);
			s.r(6, 1, 1, 13, WP.wood2);
			s.ell(6.5, 7, 5, 6, WP.leaf3);
			s.ell(5.5, 6, 3.5, 4, WP.leaf2);
			for (let i = 0; i < 5; i++) {
				let x = Math.round(3 + R() * 7), y = Math.round(3 + R() * 8);
				s.r(x, y, 2, 2, WP.fR);
				s.p(x, y, "#ffc0b5");
			}
			s.outline(WP.outline);
		});
	}
	//#endregion
	//#region src/world/art/village.ts
	function well() {
		return sprite(24, 30, (s) => {
			let x;
			s.r(4, 7, 2, 14, WP.wood2);
			s.r(18, 7, 2, 14, WP.wood2);
			for (let y = 0; y < 8; y++) {
				let hw = Math.round(3 + y * 1.35);
				s.r(12 - hw, y, hw * 2, 1, y < 3 ? WP.roof1 : y < 6 ? WP.roof2 : WP.roof3);
			}
			s.r(5, 9, 14, 1, WP.wood3);
			s.r(11, 9, 1, 6, "#6b5a45");
			s.r(9, 14, 5, 4, WP.wood2);
			s.r(9, 14, 5, 1, WP.wood1);
			s.ell(12, 20, 10, 3.5, WP.stone2);
			s.ell(12, 20, 7.5, 2.2, "#2f5f80");
			s.ell(12, 20.5, 6, 1.4, "#3f7ea6");
			for (let yy = 22; yy < 29; yy++) for (x = 2; x < 22; x++) {
				let c = (yy - 22) % 3 === 0 || (x + Math.floor((yy - 22) / 3) % 2 * 2) % 5 === 0 ? WP.stone3 : x < 8 ? WP.stone1 : WP.stone2;
				s.p(x, yy, c);
			}
			s.outline(WP.outline);
		});
	}
	function bench() {
		return sprite(22, 13, (s) => {
			s.r(2, 1, 18, 2, WP.wood1);
			s.r(2, 3, 18, 1, WP.wood2);
			s.r(2, 5, 18, 1, WP.wood1);
			s.r(1, 7, 20, 2, WP.wood1);
			s.r(1, 9, 20, 1, WP.wood3);
			s.r(3, 1, 1, 11, WP.wood3);
			s.r(18, 1, 1, 11, WP.wood3);
			s.outline(WP.outline);
		});
	}
	/** Brett mit Zetteln; `notes` aus dem Zustand (Mockup: 2). */
	function board(notes = 2) {
		return sprite(20, 22, (s) => {
			s.r(3, 2, 2, 19, WP.wood3);
			s.r(15, 2, 2, 19, WP.wood3);
			s.r(1, 2, 18, 12, WP.wood3);
			s.r(2, 3, 16, 10, WP.wood1);
			if (notes >= 1) {
				s.r(3, 4, 6, 5, WP.fW);
				s.r(4, 5, 4, 1, "#c9bba0");
				s.r(4, 7, 3, 1, "#c9bba0");
				s.p(6, 4, WP.fR);
			}
			if (notes >= 2) {
				s.r(11, 5, 6, 6, "#ffe7a8");
				s.r(12, 7, 4, 1, "#c9a96a");
				s.r(12, 9, 3, 1, "#c9a96a");
				s.p(14, 5, "#5c8de0");
			}
			s.outline(WP.outline);
		});
	}
	//#endregion
	//#region src/world/art/things.ts
	var ART = {
		bed: [
			16,
			19,
			(s, v) => {
				s.r(1, 0, 14, 5, WP.wood2);
				s.r(2, 1, 12, 3, WP.wood1);
				s.r(1, 5, 14, 12, WP.wood3);
				s.r(2, 6, 12, 4, "#fffaf0");
				s.r(2, 10, 12, 7, v[0]);
				s.r(2, 10, 12, 1, "#fff2d8");
				s.r(1, 17, 2, 2, WP.wood3);
				s.r(13, 17, 2, 2, WP.wood3);
			}
		],
		chest: [
			15,
			12,
			(s) => {
				s.r(1, 2, 13, 9, WP.wood2);
				s.r(1, 2, 13, 3, WP.wood1);
				s.r(1, 5, 13, 1, WP.wood3);
				s.r(6, 5, 3, 3, WP.fY);
			}
		],
		desk: [
			16,
			14,
			(s, v) => {
				s.r(0, 3, 16, 4, WP.wood1);
				s.r(0, 7, 16, 2, WP.wood3);
				s.r(1, 9, 2, 5, WP.wood3);
				s.r(13, 9, 2, 5, WP.wood3);
				s.r(4, 2, 5, 3, "#fffaf0");
				s.r(11, 0, 1, 4, "#5c8de0");
				if (v[0] !== "0") s.r(10, 3, 3, 2, WP.fR);
			}
		],
		workbench: [
			18,
			15,
			(s) => {
				s.r(0, 4, 18, 4, "#b98a5a");
				s.r(0, 8, 18, 2, WP.wood3);
				s.r(1, 10, 2, 5, WP.wood3);
				s.r(15, 10, 2, 5, WP.wood3);
				s.r(3, 1, 4, 3, WP.stone2);
				s.r(11, 2, 6, 1, WP.wood2);
				s.r(14, 0, 2, 3, WP.stone3);
			}
		],
		stove: [
			15,
			15,
			(s, v) => {
				s.r(1, 2, 13, 13, "#4b4559");
				s.r(1, 2, 13, 3, "#6b6478");
				s.ell(4.5, 3.5, 2, 1, "#2b2233");
				s.ell(10.5, 3.5, 2, 1, "#2b2233");
				s.r(3, 7, 9, 6, "#2b2233");
				if (v[0] === "1") s.r(4, 8, 7, 1, "#ff9a4a");
			}
		],
		tap: [
			14,
			14,
			(s) => {
				s.r(1, 5, 12, 9, WP.stone1);
				s.r(1, 5, 12, 2, "#efeae2");
				s.r(3, 6, 8, 2, WP.water1);
				s.r(6, 0, 2, 6, WP.stone3);
				s.r(6, 0, 4, 1, WP.stone3);
			}
		],
		sofa: [
			22,
			13,
			(s) => {
				s.r(0, 2, 22, 6, "#5d8fb0");
				s.r(0, 8, 22, 5, "#4a7896");
				s.r(0, 3, 3, 10, "#3e6580");
				s.r(19, 3, 3, 10, "#3e6580");
				s.r(4, 8, 7, 2, "#79acc9");
				s.r(11, 8, 7, 2, "#79acc9");
			}
		],
		table: [
			18,
			14,
			(s) => {
				s.r(0, 2, 18, 5, WP.wood1);
				s.r(0, 7, 18, 2, WP.wood3);
				s.r(1, 9, 2, 5, WP.wood3);
				s.r(15, 9, 2, 5, WP.wood3);
				s.ell(9, 3, 2.5, 1.2, WP.fR);
			}
		],
		bookshelf: [
			16,
			24,
			(s) => {
				s.r(0, 0, 16, 24, WP.wood3);
				s.r(1, 1, 14, 22, WP.wood2);
				for (let r = 0; r < 3; r++) {
					s.r(1, 7 + r * 7, 14, 1, WP.wood3);
					for (let b = 0; b < 6; b++) s.r(2 + b * 2, 2 + r * 7, 2, 5, [
						"#e05a5a",
						"#5c8de0",
						WP.fY,
						"#7fc48f",
						"#c27ad8",
						"#f0e2c4"
					][(b + r * 2) % 6]);
				}
			}
		],
		fireplace: [
			18,
			22,
			(s, v) => {
				s.r(0, 2, 18, 20, WP.stone2);
				s.r(0, 2, 18, 3, WP.stone3);
				s.r(4, 9, 10, 13, "#2b2233");
				s.r(0, 0, 18, 2, WP.wood2);
				for (let y = 6; y < 22; y += 4) s.r(0, y, 3, 1, WP.stone3);
				if (v[0] === "1") {
					s.r(6, 14, 6, 7, "#ff8a3a");
					s.r(7, 12, 4, 6, WP.fY);
					s.r(8, 16, 2, 3, "#fff3b0");
				} else s.r(6, 19, 6, 2, WP.wood3);
			}
		],
		firepit: [
			16,
			12,
			(s, v) => {
				s.ell(8, 9, 7, 2.6, WP.stone2);
				s.ell(8, 9, 4.5, 1.5, "#2b2233");
				if (v[0] === "1") {
					s.r(5, 3, 6, 6, "#ff8a3a");
					s.r(6, 1, 4, 6, WP.fY);
					s.r(7, 5, 2, 3, "#fff3b0");
				} else s.r(5, 8, 6, 1, WP.wood3);
			}
		],
		door: [
			14,
			18,
			(s, v) => {
				s.r(1, 2, 12, 16, WP.wood3);
				s.disc(7, 3, 6, WP.wood3);
				s.r(2, 3, 10, 15, WP.wood1);
				s.disc(7, 4, 5, WP.wood1);
				for (let x = 4; x < 12; x += 3) s.r(x, 1, 1, 17, WP.wood2);
				if (v[0] === "L") s.r(9, 10, 2, 2, WP.fY);
			}
		],
		board: [
			20,
			22,
			() => void 0
		],
		site: [
			16,
			22,
			(s, v) => {
				const p = Number(v[0]) / 12;
				s.r(1, 4, 2, 18, WP.wood3);
				s.r(13, 4, 2, 18, WP.wood3);
				s.r(1, 10, 14, 2, WP.wood2);
				s.r(1, 4, 14, 1, "#e8b947");
				for (let i = 0; i < Math.round(p * 3); i++) s.r(3, 18 - i * 3, 10, 2, WP.wood1);
				s.r(1, 0, 14, 2, "#4b4559");
				s.r(1, 0, Math.round(14 * p), 2, WP.leaf1);
			}
		],
		fishing_spot: [
			10,
			18,
			(s) => {
				s.r(5, 2, 1, 15, WP.wood3);
				s.r(6, 2, 3, 1, "#e8d9a8");
				s.r(8, 3, 1, 6, "#e8d9a8");
				s.r(7, 9, 2, 2, WP.fR);
			}
		],
		birdhouse: [
			10,
			24,
			(s) => {
				s.r(4, 10, 2, 14, WP.wood3);
				s.r(1, 3, 8, 8, WP.wood1);
				s.r(4, 6, 2, 2, "#2b2233");
				s.r(0, 1, 10, 3, WP.roof2);
			}
		],
		fence: [
			14,
			11,
			(s) => {
				s.r(1, 3, 3, 7, WP.wood1);
				s.r(10, 3, 3, 7, WP.wood1);
				s.r(0, 4, 14, 1, WP.wood1);
				s.r(0, 7, 14, 1, WP.wood1);
				s.r(0, 5, 14, 1, WP.wood2);
			}
		],
		pier_plank: [
			16,
			5,
			(s) => {
				s.r(0, 0, 16, 4, WP.wood1);
				for (let x = 3; x < 16; x += 4) s.r(x, 0, 1, 4, WP.wood3);
			}
		],
		key: [
			8,
			5,
			(s) => {
				s.r(0, 1, 3, 3, WP.fY);
				s.r(3, 2, 4, 1, WP.fY);
				s.r(6, 3, 1, 1, WP.fY);
			}
		],
		axe: [
			10,
			9,
			(s) => {
				s.r(1, 6, 8, 1, WP.wood2);
				s.r(6, 3, 3, 4, WP.stone2);
				s.p(6, 3, WP.stone1);
			}
		],
		pickaxe: [
			11,
			8,
			(s) => {
				s.r(5, 2, 1, 6, WP.wood2);
				s.r(1, 1, 9, 2, WP.stone2);
				s.r(1, 1, 9, 1, WP.stone1);
			}
		],
		note: [
			8,
			6,
			(s) => {
				s.r(0, 0, 8, 6, "#fffaf0");
				s.r(1, 2, 5, 1, "#c9bba0");
			}
		],
		map: [
			10,
			7,
			(s) => {
				s.r(0, 0, 10, 7, "#e8d9a8");
				s.r(2, 2, 2, 1, WP.fR);
				s.r(5, 4, 3, 1, WP.water3);
			}
		],
		meal: [
			10,
			6,
			(s) => {
				s.ell(5, 4, 4.5, 2, "#fffaf0");
				s.r(3, 2, 2, 2, WP.fR);
				s.r(6, 2, 2, 2, "#e0a458");
			}
		],
		item: [
			9,
			8,
			(s) => {
				s.r(0, 1, 9, 7, "#b0b8c8");
				s.r(0, 1, 9, 1, "#d8dde3");
			}
		],
		unknown: [
			14,
			13,
			(s) => {
				s.r(1, 2, 12, 11, "#8a8f99");
				s.r(1, 2, 12, 2, "#b4b9c2");
				s.r(6, 6, 2, 2, "#4a4f58");
			}
		]
	};
	function plant(stage, crop, wet) {
		if (stage >= 4 && crop === "tomato") return tomato(3);
		if (stage >= 4 && crop === "sunflower") return sunflower();
		return sprite(13, 15, (s) => {
			if (wet) s.ell(6.5, 13, 5, 1.5, WP.soil2);
			if (stage === 0) {
				s.ell(6.5, 13, 3, 1.2, WP.soil1);
				s.p(6, 12, WP.soil2);
			} else if (stage === 1) {
				s.r(6, 10, 1, 4, WP.leaf3);
				s.p(5, 9, WP.leaf1);
				s.p(7, 9, WP.leaf1);
			} else {
				const h = stage === 2 ? 6 : stage === 3 ? 9 : 11;
				s.ell(6.5, 14 - h / 2, 3 + stage * .6, h / 2, WP.leaf3);
				s.ell(5.5, 13 - h / 2, 2 + stage * .4, h / 3, WP.leaf2);
				s.p(5, 14 - h, WP.leaf1);
				if (stage >= 3) s.r(5, 13, 3, 2, "#e0782f");
				if (stage === 4) {
					s.r(2, 12, 2, 2, "#e0782f");
					s.r(9, 12, 2, 2, "#e0782f");
				}
			}
			s.outline(WP.outline);
		});
	}
	var make = (key) => {
		const [kind, ...v] = key.split("|");
		if (kind === "well") return well();
		if (kind === "bench") return bench();
		if (kind === "board") return board(Number(v[0]));
		if (kind === "plant") return plant(Number(v[0]), v[1], v[2] === "w");
		const [w, h, fn] = ART[kind] ?? ART.unknown;
		return sprite(w, h, (s) => {
			fn(s, v);
			s.outline(WP.outline);
		});
	};
	var objectSprite = memo((key) => key, make);
	var resourceSprite = memo((key) => key, (key) => {
		const [, res, m, c] = key.split("|"), count = Number(c);
		return sprite(16, 14, (s) => {
			if (res === "wood") for (let r = 0, k = 0; r < 3 && k < count; r++) for (let i = 0; i < 3 - r && k < count; i++, k++) {
				const cx = 4 + i * 4 + r * 2, cy = 11 - r * 4;
				s.disc(cx, cy, 2.2, WP.wood3);
				s.disc(cx, cy, 1.2, "#e0b47a");
			}
			else if (res === "stone") for (let i = 0; i < Math.max(1, Math.min(4, count)); i++) {
				const x = 2 + i % 2 * 6 + (i > 1 ? 3 : 0), y = 9 - (i > 1 ? 4 : 0);
				s.ell(x + 3, y + 2, 3, 2.2, WP.stone2);
				s.p(x + 2, y + 1, WP.stone1);
			}
			else if (res === "food" && m) for (let i = 0; i < Math.min(4, count); i++) {
				const x = 2 + i * 3, y = 11 - i % 2 * 3;
				s.r(x + 1, y, 1, 2, "#f2ece0");
				s.r(x, y - 2, 3, 2, "#e05a5a");
				s.p(x + 1, y - 2, "#fffaf0");
			}
			else if (res === "food") {
				s.r(2, 4, 12, 9, WP.wood2);
				s.r(2, 4, 12, 1, WP.wood1);
				for (let i = 0; i < Math.min(4, count); i++) s.disc(4.5 + i * 2.5, 4, 1.4, i % 2 ? WP.fR : "#e0a458");
			} else if (res === "seeds") {
				s.ell(8, 9, 5, 4.5, "#d9b77a");
				s.r(6, 3, 4, 2, "#b08a50");
				s.r(6, 8, 4, 2, WP.leaf2);
			} else if (res !== "water") s.r(6, 8, 3, 3, WP.fY);
			if (res !== "water") s.outline(WP.outline);
		});
	});
	//#endregion
	//#region ../docs/mockups/welt-optik/innen2/deko.ts
	var O = WP.outline;
	/** Fenster in der Rückwand; `sky` oben/unten nach Tageszeit, Vorhänge in der Raumfarbe. */
	var fenster = memo((top, bot, curtain, lit) => `${top}${bot}${curtain}${lit}`, (top, bot, curtain, lit) => sprite(22, 22, (s) => {
		s.r(2, 1, 18, 16, WP.wood3);
		s.r(3, 2, 16, 14, top);
		s.r(3, 9, 16, 7, bot);
		if (!lit) {
			s.p(5, 4, "#ffffff");
			s.p(6, 4, "#ffffff");
			s.p(5, 5, "#ffffff");
		}
		s.r(10, 2, 2, 14, WP.wood1);
		s.r(3, 8, 16, 1, WP.wood1);
		s.r(0, 0, 4, 18, curtain);
		s.r(18, 0, 4, 18, curtain);
		s.r(0, 0, 22, 2, curtain);
		s.p(1, 6, "#00000022");
		s.r(3, 0, 1, 18, "#00000020");
		s.r(18, 0, 1, 18, "#00000020");
		s.r(1, 17, 20, 3, WP.wood1);
		s.r(1, 17, 20, 1, "#e0b07a");
		s.r(15, 13, 4, 4, "#c2603f");
		s.p(16, 12, WP.leaf2);
		s.p(17, 11, WP.leaf1);
		s.p(18, 12, WP.fP);
		s.outline(O);
	}));
	var bild = memo((art) => art, (art) => sprite(16, 12, (s) => {
		s.r(0, 0, 16, 12, "#b88a3a");
		s.r(1, 1, 14, 10, "#e8c46a");
		s.r(2, 2, 12, 8, art === "see" ? "#9fd6f0" : "#f6e4c8");
		if (art === "see") {
			s.r(2, 7, 12, 3, "#5cc2e3");
			s.ell(6, 7, 4, 2, WP.leaf3);
			s.ell(11, 6, 3, 2, WP.leaf2);
			s.p(11, 3, "#ffe08a");
		} else if (art === "blume") {
			s.r(7, 5, 1, 4, WP.leaf3);
			s.disc(7.5, 4.5, 2, WP.fP);
			s.p(7, 4, WP.fY);
			s.r(5, 8, 6, 2, "#c2603f");
		} else {
			s.disc(8, 5, 2.5, WP.skin);
			s.r(5, 7, 6, 3, "#5d8fb0");
			s.r(5, 2, 6, 2, WP.hairA);
		}
		s.outline(O);
	}));
	var uhr = sprite(10, 16, (s) => {
		s.r(1, 0, 8, 15, WP.wood2);
		s.disc(5, 4, 3, "#fff8ec");
		s.p(5, 3, O);
		s.p(5, 4, O);
		s.p(6, 4, O);
		s.r(4, 9, 2, 4, "#e8c46a");
		s.outline(O);
	});
	var spiegel = sprite(12, 16, (s) => {
		s.ell(6, 8, 5, 7, "#b88a3a");
		s.ell(6, 8, 4, 6, "#cfe8f0");
		s.p(4, 5, "#ffffff");
		s.p(4, 6, "#ffffff");
		s.outline(O);
	});
	var wandregal = memo((was) => was, (was) => sprite(24, 12, (s) => {
		s.r(0, 9, 24, 3, WP.wood1);
		s.r(0, 9, 24, 1, "#e0b07a");
		s.r(2, 11, 2, 1, WP.wood3);
		s.r(20, 11, 2, 1, WP.wood3);
		if (was === "glaeser") for (let i = 0; i < 5; i++) {
			const x = 1 + i * 5, c = [
				"#e05a5a",
				"#ffd94f",
				"#7fc48f",
				"#e0a458",
				"#c27ad8"
			][i];
			s.r(x, 3, 4, 6, "#d8eef2");
			s.r(x, 5, 4, 4, c);
			s.r(x, 2, 4, 1, WP.wood3);
		}
		else if (was === "buecher") for (let i = 0; i < 8; i++) s.r(1 + i * 3, 2 + i % 3, 2, 7 - i % 3, [
			"#e05a5a",
			"#5c8de0",
			WP.fY,
			"#7fc48f",
			"#c27ad8",
			"#f0e2c4"
		][i % 6]);
		else {
			s.ell(5, 6, 4, 3, "#c2603f");
			s.p(5, 2, WP.leaf2);
			s.r(12, 4, 3, 5, "#fff8ec");
			s.p(13, 3, "#ffd36e");
			s.ell(19, 6, 3, 3, "#93baff");
		}
		s.outline(O);
	}));
	var toepfe = sprite(26, 12, (s) => {
		s.r(0, 0, 26, 2, WP.stone3);
		for (const [x, w, c] of [
			[
				2,
				6,
				"#c27a3a"
			],
			[
				10,
				7,
				WP.stone2
			],
			[
				19,
				5,
				"#c27a3a"
			]
		]) {
			s.r(x + w / 2 - .5, 2, 1, 2, WP.stone3);
			s.ell(x + w / 2, 7, w / 2, 3, c);
			s.r(x, 6, w, 1, "#00000030");
		}
		s.outline(O);
	});
	var werkzeugwand = sprite(30, 16, (s) => {
		s.r(0, 0, 30, 16, "#8a5f3c");
		for (let x = 2; x < 30; x += 4) for (let y = 2; y < 16; y += 4) s.p(x, y, "#5e3f28");
		s.r(3, 3, 1, 10, WP.wood2);
		s.r(1, 3, 5, 3, WP.stone2);
		s.r(9, 2, 9, 3, WP.stone1);
		for (let x = 9; x < 18; x += 2) s.p(x, 5, WP.stone3);
		s.r(17, 2, 3, 6, WP.wood2);
		s.r(23, 3, 1, 9, WP.wood2);
		s.r(22, 11, 3, 3, WP.stone2);
		s.r(26, 4, 2, 8, "#e05a5a");
		s.outline(O);
	});
	var pflanze = memo((gross) => String(gross), (gross) => sprite(gross ? 14 : 10, gross ? 22 : 14, (s) => {
		const w = gross ? 14 : 10, h = gross ? 22 : 14;
		s.r(w / 2 - 3, h - 6, 6, 6, "#c2603f");
		s.r(w / 2 - 3, h - 6, 6, 1, "#e08060");
		s.ell(w / 2, h - 10, w / 2 - 1, gross ? 8 : 4, WP.leaf3);
		s.ell(w / 2 - 1, h - 12, w / 2 - 3, gross ? 6 : 3, WP.leaf2);
		s.p(w / 2 - 2, h - 15, WP.leaf1);
		s.p(w / 2 + 2, h - 12, WP.leaf1);
		if (gross) {
			s.r(w / 2, 1, 1, 8, WP.leaf3);
			s.ell(w / 2 + 2, 3, 2, 2, WP.leaf2);
		}
		s.outline(O);
	}));
	var stehlampe = memo((lit) => String(lit), (lit) => sprite(10, 24, (s) => {
		s.r(4, 8, 2, 14, WP.wood3);
		s.r(2, 22, 6, 2, WP.wood3);
		s.r(1, 2, 8, 6, lit ? "#ffe6a0" : "#f0d8a8");
		s.r(2, 1, 6, 1, lit ? "#ffe6a0" : "#f0d8a8");
		s.r(1, 7, 8, 1, "#c8a777");
		s.outline(O);
	}));
	var nachttisch = memo((lit) => String(lit), (lit) => sprite(12, 16, (s) => {
		s.r(1, 7, 10, 9, WP.wood2);
		s.r(1, 7, 10, 2, WP.wood1);
		s.r(2, 11, 8, 1, WP.wood3);
		s.p(6, 13, WP.fY);
		s.r(4, 3, 3, 4, "#fff8ec");
		s.r(3, 6, 5, 1, "#c8a777");
		if (lit) {
			s.p(5, 1, "#ffd36e");
			s.p(5, 2, "#ff9a4a");
		} else s.p(5, 2, O);
		s.outline(O);
	}));
	var schrank = sprite(20, 28, (s) => {
		s.r(0, 2, 20, 26, WP.wood2);
		s.r(0, 0, 20, 3, WP.wood3);
		s.r(1, 3, 9, 23, WP.wood1);
		s.r(10, 3, 9, 23, WP.wood1);
		s.r(9, 3, 2, 23, WP.wood3);
		s.p(8, 14, WP.fY);
		s.p(12, 14, WP.fY);
		s.r(2, 26, 3, 2, WP.wood3);
		s.r(15, 26, 3, 2, WP.wood3);
		s.outline(O);
	});
	var sessel = memo((farbe) => farbe, (farbe) => sprite(14, 14, (s) => {
		s.r(1, 0, 12, 7, farbe);
		s.r(0, 4, 3, 9, farbe);
		s.r(11, 4, 3, 9, farbe);
		s.r(2, 7, 10, 5, farbe);
		s.r(3, 7, 8, 2, "#ffffff40");
		s.r(1, 12, 2, 2, WP.wood3);
		s.r(11, 12, 2, 2, WP.wood3);
		s.r(1, 0, 12, 1, "#ffffff30");
		s.outline(O);
	}));
	var kuechenzeile = sprite(34, 18, (s) => {
		s.r(0, 4, 34, 14, "#e8dcc4");
		s.r(0, 2, 34, 3, "#a77a52");
		s.r(0, 2, 34, 1, "#c99a6a");
		for (let i = 0; i < 4; i++) {
			s.r(1 + i * 8, 6, 7, 11, "#d2c3a4");
			s.r(4 + i * 8, 9, 2, 1, WP.wood3);
		}
		s.r(4, 0, 8, 3, "#e8c890");
		s.r(5, 1, 6, 1, "#c99a6a");
		s.r(16, 0, 5, 2, "#e05a5a");
		s.p(23, 1, "#7fc48f");
		s.p(24, 0, "#7fc48f");
		s.r(27, 0, 4, 2, "#ffd94f");
		s.outline(O);
	});
	var korb = sprite(12, 9, (s) => {
		s.ell(6, 5, 5.5, 3.5, "#c99a5a");
		s.r(1, 4, 11, 1, "#a07a42");
		s.disc(4, 3, 1.5, "#e05a5a");
		s.disc(7, 2.5, 1.5, "#ffd94f");
		s.disc(9, 3, 1.3, "#e0782f");
		s.outline(O);
	});
	var saegebock = sprite(18, 12, (s) => {
		s.r(0, 3, 18, 3, WP.wood1);
		s.r(2, 6, 2, 6, WP.wood3);
		s.r(14, 6, 2, 6, WP.wood3);
		s.r(6, 1, 8, 2, "#d8b07a");
		s.outline(O);
	});
	var kiste = sprite(12, 11, (s) => {
		s.r(0, 1, 12, 10, WP.wood1);
		s.r(0, 1, 12, 2, "#e0b07a");
		s.r(0, 5, 12, 1, WP.wood3);
		s.r(5, 1, 2, 10, WP.wood2);
		s.outline(O);
	});
	var kerze = sprite(6, 10, (s) => {
		s.r(2, 4, 2, 5, "#fff8ec");
		s.r(1, 9, 4, 1, "#c8a777");
		s.p(2, 2, "#ffd36e");
		s.p(2, 3, "#ff9a4a");
		s.outline(O);
	});
	var katze = sprite(14, 9, (s) => {
		s.ell(7, 6, 6, 3, "#e0a458");
		s.disc(11, 3.5, 2.5, "#e0a458");
		s.p(10, 1, "#e0a458");
		s.p(12, 1, "#e0a458");
		s.p(11, 3, O);
		s.r(1, 4, 2, 1, "#c27a3a");
		s.outline(O);
	});
	var fussmatte = sprite(16, 6, (s) => {
		s.r(0, 0, 16, 6, "#b8864e");
		for (let x = 1; x < 16; x += 2) s.r(x, 1, 1, 4, "#9a6a3a");
		s.outline(O);
	});
	var world_default_default = {
		schema: 1,
		home: [7, 10],
		tile_types: {
			"grass": {
				"char": ".",
				"walkable": true,
				"cost": 2,
				"color": "#5f8f4b",
				"label": "Gras"
			},
			"path": {
				"char": ",",
				"walkable": true,
				"cost": 1,
				"color": "#b59a6a",
				"label": "Weg"
			},
			"floor": {
				"char": "_",
				"walkable": true,
				"cost": 1,
				"color": "#9c7b57",
				"label": "Boden"
			},
			"wall": {
				"char": "#",
				"walkable": false,
				"cost": 0,
				"color": "#4a4a52",
				"label": "Wand"
			},
			"water": {
				"char": "~",
				"walkable": false,
				"cost": 0,
				"color": "#3f6fa8",
				"label": "Wasser"
			},
			"tree": {
				"char": "T",
				"walkable": false,
				"cost": 0,
				"color": "#2f5d34",
				"label": "Baum"
			},
			"door": {
				"char": "+",
				"walkable": true,
				"cost": 1,
				"color": "#7a5230",
				"label": "Tür"
			},
			"sand": {
				"char": "s",
				"walkable": true,
				"cost": 2,
				"color": "#d8c48a",
				"label": "Sand"
			},
			"fence": {
				"char": "f",
				"walkable": false,
				"cost": 0,
				"color": "#a96f42",
				"label": "Zaun"
			}
		},
		name: "Dorf am See",
		size: [51, 19],
		tiles: [
			"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
			"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
			"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
			"TTTTTTTTTTTTTTTTTTTTTTTTTT########################T",
			"TTTTTTTTTTTTTTTTTTTTTTTTTT#______#______#________#T",
			"TTTTTTTTTTTTTTTTTTTTTTTTTT#______#______#________#T",
			"TTT..................TTTTT#______#______#________#T",
			"TTT..................TTTTT#______#______#________#T",
			"TTT..######..T.T...T.TTTTT#______#______#________#T",
			"TTT..######..........TTTTT####+####+########+#####T",
			"TTT..##+###T...T~~~~.TTTTT#_________#____________#T",
			"TTT.....,.......~~~~~TTTTT#_________#____________#T",
			"TTT...T..,,,,,,_~~~~~TTTTT#_________+____________#T",
			"TTTT.fffff.,,,..~~~~.TTTTT#_________#____________#T",
			"TTT.f....f,,,........TTTTT#_________#____________#T",
			"TTT.f....,.....T.....TTTTT################+#######T",
			"TTT.f....f...........TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
			"TTT..fffff.........T.TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
			"TTTTT......TT.....T..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT"
		],
		locations: [
			{
				"id": "house.bedroom_a",
				"name": "Zimmer Alex",
				"rect": [
					27,
					4,
					6,
					5
				],
				"entrances": [[30, 9]],
				"extra_tiles": [[30, 9]],
				"props": {
					"style": { "floor": "planks" },
					"to": "in Alex' Zimmer",
					"at": "in Alex' Zimmer",
					"themes": ["rest"]
				}
			},
			{
				"id": "house.bedroom_b",
				"name": "Zimmer Mira",
				"rect": [
					34,
					4,
					6,
					5
				],
				"entrances": [[35, 9]],
				"extra_tiles": [[35, 9]],
				"props": {
					"style": { "floor": "planks" },
					"to": "in Miras Zimmer",
					"at": "in Miras Zimmer",
					"themes": ["rest"]
				}
			},
			{
				"id": "house.workshop",
				"name": "Werkstatt",
				"rect": [
					41,
					4,
					8,
					5
				],
				"entrances": [[44, 9]],
				"extra_tiles": [[44, 9]],
				"props": {
					"style": { "floor": "workshop" },
					"to": "in die Werkstatt",
					"at": "in der Werkstatt",
					"themes": ["craft", "wood"]
				}
			},
			{
				"id": "house.kitchen",
				"name": "Küche",
				"rect": [
					27,
					10,
					9,
					5
				],
				"entrances": [[30, 9], [36, 12]],
				"extra_tiles": [],
				"props": {
					"style": { "floor": "tile" },
					"to": "in die Küche",
					"at": "in der Küche",
					"themes": ["food"]
				}
			},
			{
				"id": "house.living",
				"name": "Wohnzimmer",
				"rect": [
					37,
					10,
					12,
					5
				],
				"entrances": [
					[36, 12],
					[42, 15],
					[44, 9]
				],
				"extra_tiles": [[36, 12], [42, 15]],
				"props": {
					"style": {
						"floor": "planks",
						"rug": true
					},
					"to": "ins Wohnzimmer",
					"at": "im Wohnzimmer",
					"themes": ["social", "rest"]
				}
			},
			{
				"id": "garden",
				"name": "Garten",
				"rect": [
					5,
					14,
					4,
					3
				],
				"entrances": [[9, 15]],
				"extra_tiles": [],
				"props": {
					"style": { "fence": true },
					"beds": 6,
					"to": "in den Garten",
					"at": "im Garten",
					"themes": ["garden", "plants"]
				}
			},
			{
				"id": "square",
				"name": "Zentraler Platz",
				"rect": [
					11,
					12,
					3,
					3
				],
				"entrances": [],
				"extra_tiles": [],
				"props": {
					"style": { "surface": "cobble" },
					"market_area": [
						11,
						12,
						3,
						3
					],
					"to": "zum zentralen Platz",
					"at": "auf dem zentralen Platz",
					"themes": ["social"]
				}
			},
			{
				"id": "lake",
				"name": "See",
				"rect": [
					15,
					9,
					6,
					6
				],
				"entrances": [],
				"extra_tiles": [],
				"props": {
					"fishing": true,
					"to": "zum See",
					"at": "am See",
					"themes": [
						"water",
						"calm",
						"nature"
					]
				}
			},
			{
				"id": "forest",
				"name": "Wald",
				"rect": [
					0,
					0,
					25,
					7
				],
				"entrances": [],
				"extra_tiles": [],
				"props": {
					"clearing": [
						4,
						6,
						17,
						1
					],
					"unexplored": true,
					"to": "in den Wald",
					"at": "im Wald",
					"themes": ["nature", "wood"]
				}
			},
			{
				"id": "paths",
				"name": "Wege und Wiesen",
				"rect": [
					0,
					0,
					51,
					19
				],
				"entrances": [],
				"extra_tiles": [],
				"props": {
					"fallback": true,
					"to": "auf die Wege",
					"at": "auf den Wegen",
					"themes": []
				}
			}
		],
		objects: [
			{
				"id": "bed_alex",
				"kind": "bed",
				"name": "Bett (Alex)",
				"tile": [28, 5],
				"state": {},
				"owner": "alex"
			},
			{
				"id": "chest_alex",
				"kind": "chest",
				"name": "Truhe",
				"tile": [32, 5],
				"state": {}
			},
			{
				"id": "bed_mira",
				"kind": "bed",
				"name": "Bett (Mira)",
				"tile": [35, 5],
				"state": {},
				"owner": "mira"
			},
			{
				"id": "desk_mira",
				"kind": "desk",
				"name": "Schreibtisch",
				"tile": [38, 5],
				"state": { "notes": [] }
			},
			{
				"id": "workbench",
				"kind": "workbench",
				"name": "Werkbank",
				"tile": [42, 5],
				"state": {}
			},
			{
				"id": "axe",
				"kind": "axe",
				"name": "Axt",
				"tile": [44, 5],
				"state": {},
				"portable": true
			},
			{
				"id": "pickaxe",
				"kind": "pickaxe",
				"name": "Spitzhacke",
				"tile": [45, 5],
				"state": {},
				"portable": true
			},
			{
				"id": "stove",
				"kind": "stove",
				"name": "Herd",
				"tile": [28, 11],
				"state": {}
			},
			{
				"id": "kitchen_tap",
				"kind": "tap",
				"name": "Wasserhahn",
				"tile": [32, 14],
				"state": {}
			},
			{
				"id": "sofa",
				"kind": "sofa",
				"name": "Sofa",
				"tile": [39, 12],
				"state": {}
			},
			{
				"id": "table_living",
				"kind": "table",
				"name": "Tisch",
				"tile": [43, 12],
				"state": {}
			},
			{
				"id": "bookshelf",
				"kind": "bookshelf",
				"name": "Bücherregal",
				"tile": [47, 10],
				"state": { "books": [
					"Pilzkunde",
					"Alte Dorfchronik",
					"Gartenjahr"
				] }
			},
			{
				"id": "fireplace",
				"kind": "fireplace",
				"name": "Kamin",
				"tile": [48, 12],
				"state": { "lit": false }
			},
			{
				"id": "door_ba",
				"kind": "door",
				"name": "Tür Zimmer Alex",
				"tile": [30, 9],
				"state": { "locked": false }
			},
			{
				"id": "door_bb",
				"kind": "door",
				"name": "Tür Zimmer Mira",
				"tile": [35, 9],
				"state": { "locked": false }
			},
			{
				"id": "door_ws",
				"kind": "door",
				"name": "Tür Werkstatt",
				"tile": [44, 9],
				"state": { "locked": false }
			},
			{
				"id": "door_kl",
				"kind": "door",
				"name": "Tür Küche",
				"tile": [36, 12],
				"state": { "locked": false }
			},
			{
				"id": "door_front",
				"kind": "door",
				"name": "Haustür",
				"tile": [42, 15],
				"state": { "locked": false }
			},
			{
				"id": "seedbed_1",
				"kind": "seedbed",
				"name": "Beet 1",
				"tile": [6, 14],
				"state": {}
			},
			{
				"id": "seedbed_2",
				"kind": "seedbed",
				"name": "Beet 2",
				"tile": [7, 14],
				"state": {}
			},
			{
				"id": "seedbed_3",
				"kind": "seedbed",
				"name": "Beet 3",
				"tile": [8, 14],
				"state": {}
			},
			{
				"id": "seedbed_4",
				"kind": "seedbed",
				"name": "Beet 4",
				"tile": [6, 16],
				"state": {}
			},
			{
				"id": "seedbed_5",
				"kind": "seedbed",
				"name": "Beet 5",
				"tile": [7, 16],
				"state": {}
			},
			{
				"id": "seedbed_6",
				"kind": "seedbed",
				"name": "Beet 6",
				"tile": [8, 16],
				"state": {}
			},
			{
				"id": "well_square",
				"kind": "well",
				"name": "Dorfbrunnen",
				"tile": [12, 13],
				"state": {}
			},
			{
				"id": "bench_square",
				"kind": "bench",
				"name": "Bank am Platz",
				"tile": [9, 13],
				"state": {}
			},
			{
				"id": "board_square",
				"kind": "board",
				"name": "Anschlagtafel",
				"tile": [13, 11],
				"state": { "notes": ["Willkommen im Dorf."] }
			},
			{
				"id": "fishing_spot",
				"kind": "fishing_spot",
				"name": "Angelplatz",
				"tile": [16, 12],
				"state": {}
			},
			{
				"id": "old_key",
				"kind": "key",
				"name": "Rostiger Schlüssel",
				"tile": [3, 6],
				"state": {},
				"portable": true,
				"hidden": true
			}
		],
		resource_nodes: [
			{
				"id": "pantry",
				"location_id": "house.kitchen",
				"tile": [34, 11],
				"resource": "food",
				"amount": 10,
				"cap": 16,
				"regen_per_hour": .4,
				"requires_tool": null,
				"gather_minutes": 3
			},
			{
				"id": "tap_kitchen",
				"location_id": "house.kitchen",
				"tile": [32, 14],
				"resource": "water",
				"amount": 999,
				"cap": 999,
				"regen_per_hour": 999,
				"requires_tool": null,
				"gather_minutes": 2
			},
			{
				"id": "woodpile",
				"location_id": "house.workshop",
				"tile": [47, 5],
				"resource": "wood",
				"amount": 6,
				"cap": 12,
				"regen_per_hour": 0,
				"requires_tool": null,
				"gather_minutes": 3
			},
			{
				"id": "seed_box",
				"location_id": "house.workshop",
				"tile": [47, 7],
				"resource": "seeds",
				"amount": 6,
				"cap": 6,
				"regen_per_hour": 0,
				"requires_tool": null,
				"gather_minutes": 2
			},
			{
				"id": "well_square_water",
				"location_id": "square",
				"tile": [12, 13],
				"resource": "water",
				"amount": 999,
				"cap": 999,
				"regen_per_hour": 999,
				"requires_tool": null,
				"gather_minutes": 2
			},
			{
				"id": "lake_water",
				"location_id": "lake",
				"tile": [15, 12],
				"resource": "water",
				"amount": 999,
				"cap": 999,
				"regen_per_hour": 999,
				"requires_tool": null,
				"gather_minutes": 2
			},
			{
				"id": "shore_rocks",
				"location_id": "lake",
				"tile": [17, 15],
				"resource": "stone",
				"amount": 15,
				"cap": 15,
				"regen_per_hour": .2,
				"requires_tool": "pickaxe",
				"gather_minutes": 10
			},
			{
				"id": "forest_wood",
				"location_id": "forest",
				"tile": [8, 5],
				"resource": "wood",
				"amount": 40,
				"cap": 40,
				"regen_per_hour": 1.5,
				"requires_tool": "axe",
				"gather_minutes": 8
			},
			{
				"id": "forest_mushrooms",
				"location_id": "forest",
				"tile": [14, 5],
				"resource": "food",
				"amount": 8,
				"cap": 8,
				"regen_per_hour": .3,
				"requires_tool": null,
				"gather_minutes": 5
			},
			{
				"id": "forest_seeds",
				"location_id": "forest",
				"tile": [19, 5],
				"resource": "seeds",
				"amount": 6,
				"cap": 10,
				"regen_per_hour": .1,
				"requires_tool": null,
				"gather_minutes": 4
			}
		],
		agents: [{
			"id": "alex",
			"name": "Alex",
			"tile": [7, 15],
			"capacity": 10,
			"needs": {
				"energy": 85,
				"hunger": 25,
				"thirst": 20
			}
		}, {
			"id": "mira",
			"name": "Mira",
			"tile": [11, 14],
			"capacity": 10,
			"needs": {
				"energy": 85,
				"hunger": 25,
				"thirst": 20
			}
		}],
		start: {
			"day": 1,
			"minute_of_day": 420,
			"weather": "clear"
		},
		links: [[[7, 10], [42, 15]]],
		look: {
			"style": "mockup-a",
			"origin": [66, 104],
			"texture": {
				"offset": [64, 96],
				"size": [384, 288]
			},
			"shapes": {
				"paths": [
					[
						[60, 60],
						[60, 80],
						[104, 100]
					],
					[
						[152, 102],
						[174, 97],
						[186, 93]
					],
					[[110, 120], [86, 146]],
					[
						[128, 130],
						[126, 160],
						[130, 200]
					]
				],
				"square": {
					"x": 128,
					"y": 106,
					"r": 27
				},
				"lake": {
					"x": 222,
					"y": 90,
					"rx": 40,
					"ry": 37
				},
				"garden": {
					"x0": 14,
					"y0": 120,
					"x1": 84,
					"y1": 176
				},
				"beds": [
					[
						22,
						127,
						54,
						9
					],
					[
						22,
						141,
						54,
						9
					],
					[
						22,
						155,
						54,
						9
					]
				],
				"house": {
					"x": 60,
					"y": 60
				},
				"dock": {
					"x0": 180,
					"y0": 88,
					"x1": 202,
					"y1": 97
				}
			},
			"decor": [
				[
					"house",
					60,
					60,
					0
				],
				[
					"mailbox",
					86,
					66,
					0
				],
				[
					"barrel",
					26,
					62,
					0
				],
				[
					"barrel",
					33,
					64,
					0
				],
				[
					"bushP",
					44,
					68,
					0
				],
				[
					"bushY",
					76,
					68,
					0
				],
				[
					"bush",
					98,
					58,
					0
				],
				[
					"bushW",
					20,
					84,
					0
				],
				[
					"lamp",
					103,
					86,
					0
				],
				[
					"lamp",
					154,
					128,
					0
				],
				[
					"lamp",
					200,
					88,
					0
				],
				[
					"sign",
					138,
					142,
					0
				],
				[
					"fence",
					21,
					176,
					0
				],
				[
					"fence",
					21,
					120,
					0
				],
				[
					"fence",
					33,
					176,
					0
				],
				[
					"fence",
					33,
					120,
					0
				],
				[
					"fence",
					45,
					176,
					0
				],
				[
					"fence",
					45,
					120,
					0
				],
				[
					"fence",
					57,
					176,
					0
				],
				[
					"fence",
					57,
					120,
					0
				],
				[
					"fence",
					69,
					176,
					0
				],
				[
					"fence",
					69,
					120,
					0
				],
				[
					"fence",
					81,
					176,
					0
				],
				[
					"fence",
					81,
					120,
					0
				],
				[
					"post",
					14,
					128,
					0
				],
				[
					"post",
					84,
					128,
					0
				],
				[
					"post",
					14,
					136,
					0
				],
				[
					"post",
					84,
					136,
					0
				],
				[
					"post",
					14,
					144,
					0
				],
				[
					"post",
					14,
					152,
					0
				],
				[
					"post",
					14,
					160,
					0
				],
				[
					"post",
					84,
					160,
					0
				],
				[
					"post",
					14,
					168,
					0
				],
				[
					"post",
					84,
					168,
					0
				],
				[
					"sun",
					26,
					124,
					0
				],
				[
					"sun",
					34,
					123,
					0
				],
				[
					"sun",
					42,
					124,
					0
				],
				[
					"tomato",
					32,
					136,
					1
				],
				[
					"tomato",
					48,
					136,
					2
				],
				[
					"tomato",
					64,
					136,
					3
				],
				[
					"scare",
					78,
					128,
					0
				],
				[
					"boat",
					230,
					106,
					0
				],
				[
					"reed",
					186,
					74,
					0
				],
				[
					"reed",
					189,
					108,
					0
				],
				[
					"reed",
					206,
					124,
					0
				],
				[
					"reed",
					244,
					122,
					0
				],
				[
					"reed",
					254,
					70,
					0
				],
				[
					"rock",
					150,
					172,
					0
				],
				[
					"rock",
					6,
					102,
					0
				],
				[
					"rock",
					150,
					66,
					0
				],
				[
					"tree",
					20,
					30,
					0
				],
				[
					"tree",
					104,
					32,
					1
				],
				[
					"treeF",
					118,
					58,
					2
				],
				[
					"tree",
					176,
					40,
					3
				],
				[
					"tree",
					246,
					36,
					4
				],
				[
					"tree",
					8,
					150,
					5
				],
				[
					"tree",
					244,
					170,
					6
				],
				[
					"treeF",
					176,
					152,
					7
				],
				[
					"treeB",
					182,
					64,
					8
				],
				[
					"treeB",
					30,
					100,
					9
				],
				[
					"tree",
					234,
					186,
					10
				],
				[
					"tree",
					8,
					186,
					11
				],
				[
					"tree",
					150,
					36,
					12
				],
				[
					"tree",
					134,
					-47,
					100
				],
				[
					"tree",
					164,
					-19,
					101
				],
				[
					"tree",
					-30,
					-47,
					102
				],
				[
					"tree",
					111,
					-52,
					103
				],
				[
					"tree",
					100,
					-35,
					104
				],
				[
					"pine",
					1,
					-78,
					105
				],
				[
					"tree",
					90,
					-61,
					106
				],
				[
					"tree",
					-12,
					-41,
					107
				],
				[
					"tree",
					99,
					-20,
					108
				],
				[
					"tree",
					232,
					-66,
					109
				],
				[
					"tree",
					36,
					-89,
					110
				],
				[
					"pine",
					312,
					-68,
					111
				],
				[
					"tree",
					223,
					-63,
					112
				],
				[
					"pine",
					159,
					-20,
					113
				],
				[
					"pine",
					263,
					-22,
					114
				],
				[
					"tree",
					-50,
					-87,
					115
				],
				[
					"pine",
					129,
					-48,
					116
				],
				[
					"pine",
					131,
					-29,
					117
				],
				[
					"pine",
					185,
					-90,
					118
				],
				[
					"pine",
					181,
					-7,
					119
				],
				[
					"pine",
					117,
					-63,
					120
				],
				[
					"tree",
					219,
					-57,
					121
				],
				[
					"pine",
					54,
					-45,
					122
				],
				[
					"pine",
					260,
					-80,
					123
				],
				[
					"pine",
					179,
					-39,
					124
				],
				[
					"tree",
					80,
					-61,
					125
				],
				[
					"pine",
					264,
					-39,
					126
				],
				[
					"pine",
					289,
					-42,
					127
				],
				[
					"pine",
					57,
					-49,
					128
				],
				[
					"pine",
					275,
					-67,
					129
				],
				[
					"tree",
					-13,
					-87,
					130
				],
				[
					"pine",
					147,
					-49,
					131
				],
				[
					"tree",
					153,
					-39,
					132
				],
				[
					"tree",
					305,
					-41,
					133
				],
				[
					"pine",
					158,
					-51,
					134
				],
				[
					"tree",
					188,
					-37,
					135
				],
				[
					"pine",
					210,
					-82,
					136
				],
				[
					"pine",
					186,
					-8,
					137
				],
				[
					"tree",
					292,
					-61,
					138
				],
				[
					"pine",
					188,
					-88,
					139
				],
				[
					"tree",
					192,
					-51,
					140
				],
				[
					"pine",
					26,
					-31,
					141
				],
				[
					"pine",
					-25,
					-45,
					142
				],
				[
					"tree",
					9,
					-22,
					143
				],
				[
					"pine",
					225,
					-94,
					144
				],
				[
					"tree",
					263,
					-44,
					145
				],
				[
					"tree",
					179,
					-94,
					146
				],
				[
					"tree",
					127,
					-80,
					147
				],
				[
					"tree",
					-36,
					-87,
					148
				],
				[
					"tree",
					173,
					-32,
					149
				],
				[
					"pine",
					289,
					-8,
					150
				],
				[
					"pine",
					4,
					-42,
					151
				],
				[
					"pine",
					99,
					-47,
					152
				],
				[
					"pine",
					-37,
					-53,
					153
				],
				[
					"pine",
					99,
					-30,
					154
				],
				[
					"pine",
					68,
					-42,
					155
				],
				[
					"pine",
					311,
					-68,
					156
				],
				[
					"pine",
					33,
					-34,
					157
				],
				[
					"pine",
					154,
					-37,
					158
				],
				[
					"tree",
					-10,
					-79,
					159
				],
				[
					"pine",
					-8,
					-22,
					160
				],
				[
					"tree",
					180,
					-21,
					161
				],
				[
					"pine",
					249,
					-85,
					162
				],
				[
					"pine",
					223,
					-75,
					163
				],
				[
					"tree",
					70,
					-85,
					164
				],
				[
					"tree",
					183,
					-31,
					165
				],
				[
					"pine",
					227,
					-32,
					166
				],
				[
					"pine",
					230,
					-74,
					167
				],
				[
					"pine",
					-7,
					-39,
					168
				],
				[
					"tree",
					154,
					-9,
					169
				],
				[
					"pine",
					138,
					-17,
					170
				],
				[
					"pine",
					141,
					-26,
					171
				],
				[
					"tree",
					313,
					-82,
					172
				],
				[
					"tree",
					119,
					-12,
					173
				],
				[
					"pine",
					88,
					-53,
					174
				],
				[
					"pine",
					-22,
					-77,
					175
				],
				[
					"tree",
					-26,
					-12,
					176
				],
				[
					"tree",
					157,
					-74,
					177
				],
				[
					"pine",
					-31,
					-20,
					178
				],
				[
					"pine",
					-36,
					-55,
					179
				],
				[
					"pine",
					-7,
					-61,
					180
				],
				[
					"tree",
					281,
					-43,
					181
				],
				[
					"tree",
					317,
					-63,
					182
				],
				[
					"tree",
					147,
					-71,
					183
				],
				[
					"tree",
					299,
					-67,
					184
				],
				[
					"pine",
					95,
					-83,
					185
				],
				[
					"pine",
					180,
					-92,
					186
				],
				[
					"pine",
					222,
					-80,
					187
				],
				[
					"tree",
					104,
					-25,
					188
				],
				[
					"pine",
					170,
					-35,
					189
				],
				[
					"pine",
					228,
					-13,
					190
				],
				[
					"pine",
					210,
					-87,
					191
				],
				[
					"pine",
					139,
					-34,
					192
				],
				[
					"pine",
					290,
					-14,
					193
				],
				[
					"tree",
					281,
					-60,
					194
				],
				[
					"tree",
					-19,
					189,
					300
				],
				[
					"pine",
					278,
					63,
					400
				],
				[
					"tree",
					-23,
					10,
					301
				],
				[
					"tree",
					272,
					84,
					401
				],
				[
					"tree",
					-37,
					186,
					302
				],
				[
					"tree",
					272,
					19,
					402
				],
				[
					"pine",
					-57,
					185,
					303
				],
				[
					"pine",
					300,
					57,
					403
				],
				[
					"pine",
					-22,
					148,
					304
				],
				[
					"tree",
					317,
					108,
					404
				],
				[
					"tree",
					-31,
					77,
					305
				],
				[
					"pine",
					313,
					20,
					405
				],
				[
					"tree",
					-36,
					132,
					306
				],
				[
					"tree",
					276,
					131,
					406
				],
				[
					"pine",
					-43,
					19,
					307
				],
				[
					"tree",
					287,
					19,
					407
				],
				[
					"tree",
					-36,
					39,
					308
				],
				[
					"pine",
					269,
					77,
					408
				],
				[
					"tree",
					-37,
					177,
					309
				],
				[
					"pine",
					284,
					119,
					409
				],
				[
					"pine",
					-40,
					108,
					310
				],
				[
					"tree",
					303,
					123,
					410
				],
				[
					"tree",
					-27,
					32,
					311
				],
				[
					"pine",
					273,
					43,
					411
				],
				[
					"tree",
					-50,
					26,
					312
				],
				[
					"pine",
					309,
					146,
					412
				],
				[
					"pine",
					-39,
					2,
					313
				],
				[
					"pine",
					308,
					93,
					413
				],
				[
					"pine",
					-56,
					6,
					314
				],
				[
					"pine",
					292,
					3,
					414
				],
				[
					"tree",
					-12,
					48,
					315
				],
				[
					"pine",
					272,
					31,
					415
				],
				[
					"pine",
					-37,
					149,
					316
				],
				[
					"tree",
					287,
					168,
					416
				],
				[
					"pine",
					-42,
					122,
					317
				],
				[
					"tree",
					301,
					77,
					417
				],
				[
					"tree",
					-35,
					79,
					318
				],
				[
					"pine",
					316,
					60,
					418
				],
				[
					"tree",
					-55,
					124,
					319
				],
				[
					"pine",
					299,
					44,
					419
				],
				[
					"tree",
					-22,
					39,
					320
				],
				[
					"tree",
					287,
					70,
					420
				],
				[
					"pine",
					-57,
					173,
					321
				],
				[
					"pine",
					293,
					168,
					421
				],
				[
					"tree",
					-50,
					178,
					322
				],
				[
					"pine",
					295,
					69,
					422
				],
				[
					"pine",
					-53,
					6,
					323
				],
				[
					"pine",
					269,
					58,
					423
				],
				[
					"tree",
					-35,
					48,
					324
				],
				[
					"tree",
					299,
					149,
					424
				],
				[
					"tree",
					-48,
					86,
					325
				],
				[
					"pine",
					302,
					62,
					425
				]
			],
			"lights": [
				[
					43,
					60,
					32,
					1
				],
				[
					77,
					60,
					32,
					1
				],
				[
					60,
					60,
					59,
					.8
				],
				[
					69,
					60,
					31,
					.7
				],
				[
					103,
					86,
					24,
					1
				],
				[
					154,
					128,
					24,
					1
				],
				[
					200,
					88,
					24,
					1
				]
			],
			"place": {
				"well_square": { "at": [128, 109] },
				"bench_square": { "at": [92, 112] },
				"board_square": { "at": [152, 86] },
				"fishing_spot": {
					"at": [200, 92],
					"sprite": "none"
				},
				"seedbed_1": {
					"at": [42, 131],
					"sprite": "none"
				},
				"seedbed_2": {
					"at": [56, 131],
					"sprite": "none"
				},
				"seedbed_3": {
					"at": [70, 131],
					"sprite": "none"
				},
				"seedbed_4": {
					"at": [42, 159],
					"sprite": "none"
				},
				"seedbed_5": {
					"at": [56, 159],
					"sprite": "none"
				},
				"seedbed_6": {
					"at": [70, 159],
					"sprite": "none"
				},
				"shore_rocks": {
					"at": [210, 150],
					"sprite": "rock"
				},
				"well_square_water": {
					"at": [128, 109],
					"sprite": "none"
				},
				"lake_water": {
					"at": [186, 92],
					"sprite": "none"
				},
				"forest_wood": {
					"at": [0, 0],
					"sprite": "none"
				},
				"forest_mushrooms": {
					"at": [0, 0],
					"sprite": "none"
				},
				"forest_seeds": {
					"at": [0, 0],
					"sprite": "none"
				}
			},
			"door": {
				"outside": [7, 10],
				"inside": [42, 15],
				"at": [60, 60]
			},
			"interior": { "rect": [
				26,
				3,
				24,
				13
			] }
		}
	};
	var ROWS = world_default_default.tiles;
	var kind = (tx, ty) => ROWS[ty]?.[tx] ?? "T";
	var STYLE = {
		"house.bedroom_a": {
			paper: "streifen",
			floor: "dielen"
		},
		"house.bedroom_b": {
			paper: "blumen",
			floor: "dielenHell"
		},
		"house.workshop": {
			paper: "bretter",
			floor: "werkstatt"
		},
		"house.kitchen": {
			paper: "kacheln",
			floor: "fliesen"
		},
		"house.living": {
			paper: "ranken",
			floor: "parkett"
		}
	};
	var ROOMS = world_default_default.locations.filter((l) => l.id.startsWith("house.")).map((l) => ({
		id: l.id,
		name: l.name,
		r: l.rect,
		band: l.rect[1] < 9 ? 0 : 1,
		...STYLE[l.id]
	}));
	var roomAt = (tx, ty) => ROOMS.find((R) => tx >= R.r[0] && ty >= R.r[1] && tx < R.r[0] + R.r[2] && ty < R.r[1] + R.r[3]);
	var MID0 = 144;
	var MID1 = 160;
	var Y1 = 158;
	function Y(y) {
		if (y < MID0) return 34 + (y - 64);
		if (y < MID1) return 114 + (y - MID0) / 16 * 44;
		return Y1 + (y - MID1);
	}
	var HEIGHT = Y(240) + 7 + 4;
	var bandTop = (b) => b === 0 ? 0 : 124;
	var floorTop = (b) => b === 0 ? 34 : Y1;
	var C = (r, g, b) => [
		r,
		g,
		b
	];
	var P = {
		plankA: C(201, 140, 86),
		plankB: C(186, 126, 76),
		plankC: C(214, 156, 100),
		gap: C(140, 92, 58),
		hellA: C(226, 184, 132),
		hellB: C(212, 168, 118),
		hellGap: C(166, 120, 80),
		wsA: C(150, 112, 80),
		wsB: C(136, 100, 72),
		wsGap: C(98, 70, 50),
		dust: C(200, 170, 120),
		tileA: C(236, 226, 206),
		tileB: C(196, 112, 84),
		grout: C(170, 150, 130),
		parA: C(178, 112, 66),
		parB: C(160, 98, 58),
		parGap: C(118, 70, 42)
	};
	function floorColor(style, wx, wy) {
		hash(wx >> 2, wy >> 2, 3);
		if (style === "fliesen") {
			const gx = wx % 10, gy = wy % 10;
			if (gx === 0 || gy === 0) return P.grout;
			return Math.floor(wx / 10) + Math.floor(wy / 10) & 1 ? P.tileB : P.tileA;
		}
		if (style === "parkett") {
			const u = Math.floor((wx + wy) / 6), v = Math.floor((wx - wy + 400) / 6);
			if ((u + v & 1 ? (wx + wy) % 6 : (wx - wy + 400) % 6) === 0) return P.parGap;
			return hash(u, v, 7) < .5 ? P.parA : P.parB;
		}
		const row = Math.floor(wy / 5), off = hash(row, 0, 5) * 40, seam = Math.floor((wx + off) / 28);
		if (style === "werkstatt") {
			if (wy % 5 === 0 || (wx + Math.floor(off)) % 28 === 0) return P.wsGap;
			if (hash(wx, wy, 9) > .985) return P.dust;
			return hash(seam, row, 2) < .5 ? P.wsA : P.wsB;
		}
		const hell = style === "dielenHell";
		if (wy % 5 === 0 || (wx + Math.floor(off)) % 28 === 0) return hell ? P.hellGap : P.gap;
		if ((wx + Math.floor(off)) % 28 === 3 && wy % 5 === 2) return hell ? P.hellGap : P.gap;
		const t = hash(seam, row, 2) + (noise(wx * .2, wy * .6, 4) - .5) * .2;
		return hell ? t < .5 ? P.hellA : P.hellB : t < .33 ? P.plankA : t < .66 ? P.plankB : P.plankC;
	}
	var W = {
		streifen: [C(150, 170, 196), C(132, 152, 182)],
		blumen: [C(236, 190, 196), C(250, 214, 216)],
		bretter: [C(166, 120, 82), C(146, 104, 70)],
		kacheln: [C(242, 236, 222), C(122, 170, 176)],
		ranken: [C(120, 160, 120), C(104, 142, 106)]
	};
	function paperColor(paper, lx, ly, h) {
		if (ly < 3) return ly === 2 ? C(110, 76, 52) : C(150, 104, 70);
		if (ly >= h - 4) return ly === h - 4 ? C(110, 76, 52) : C(172, 122, 82);
		if (paper === "streifen") return Math.floor(lx / 4) % 2 ? W.streifen[0] : W.streifen[1];
		if (paper === "blumen") {
			const cx = lx % 8, cy = (ly + Math.floor(lx / 8) % 2 * 4) % 8;
			return cx === 4 && cy === 4 ? C(214, 110, 130) : (cx === 3 || cx === 5) && cy === 4 ? C(150, 190, 130) : W.blumen[1];
		}
		if (paper === "bretter") return lx % 7 === 0 ? C(110, 76, 52) : hash(Math.floor(lx / 7), 0, 4) < .5 ? W.bretter[0] : W.bretter[1];
		if (paper === "kacheln") {
			if (ly > h * .55) {
				const gx = lx % 6, gy = ly % 6;
				return gx === 0 || gy === 0 ? C(200, 196, 186) : W.kacheln[1];
			}
			return W.kacheln[0];
		}
		if (ly > h * .55) return lx % 6 === 0 ? C(120, 82, 56) : C(156, 108, 72);
		const cx = lx % 10, cy = ly % 10;
		return cx === 5 && (cy === 3 || cy === 7) || cy === 5 && (cx === 3 || cx === 7) ? W.ranken[1] : W.ranken[0];
	}
	var objects = world_default_default.objects.filter((o) => o.tile[0] >= 26 && o.tile[0] < 50 && o.tile[1] >= 3 && o.tile[1] < 16);
	var resources = world_default_default.resource_nodes.filter((n) => n.location_id.startsWith("house."));
	WPA.wild3;
	//#endregion
	//#region ../docs/mockups/welt-optik/innen2/main.ts
	var zeit = "Mittag";
	var variante = "haus";
	var raum = "house.living";
	var cv = document.getElementById("bild");
	var g = cv.getContext("2d");
	var dpr = Math.max(1, Math.round(devicePixelRatio || 1));
	var X = (wx) => wx - 416;
	var lit = () => TIMES[zeit].lights > .5;
	var SKY = {
		Morgen: ["#a9cff2", "#ffe2cb"],
		Mittag: ["#6cb7f3", "#cfefff"],
		Abend: ["#5d5ba8", "#ffab79"],
		Nacht: ["#0f1534", "#353b70"]
	};
	var CURTAIN = {
		"house.bedroom_a": "#5d7fb0",
		"house.bedroom_b": "#d97a92",
		"house.workshop": "#a9884e",
		"house.kitchen": "#e0a458",
		"house.living": "#b04a4a"
	};
	function backWall(img, R) {
		const top = bandTop(R.band), h = floorTop(R.band) - top, x0 = X(R.r[0] * 16) - 8, x1 = X((R.r[0] + R.r[2]) * 16) + 8, d = img.data;
		for (let y = 0; y < h; y++) for (let x = Math.max(0, x0); x < Math.min(384, x1); x++) {
			const c = paperColor(R.paper, x - x0, y, h), o = ((top + y) * 384 + x) * 4;
			d[o] = c[0];
			d[o + 1] = c[1];
			d[o + 2] = c[2];
			d[o + 3] = 255;
		}
	}
	function base() {
		const c = canvas(384, HEIGHT), b = c.getContext("2d"), img = b.createImageData(384, HEIGHT), d = img.data;
		for (let i = 0; i < 384 * HEIGHT; i++) {
			d[i * 4] = 26;
			d[i * 4 + 1] = 19;
			d[i * 4 + 2] = 34;
			d[i * 4 + 3] = 255;
		}
		for (const R of ROOMS) backWall(img, R);
		for (let wy = 64; wy < 240; wy++) {
			const ty = Math.floor(wy / 16);
			if (ty === 9) continue;
			for (let wx = 424; wx < 792; wx++) {
				const tx = Math.floor(wx / 16), k = kind(tx, ty);
				let R = roomAt(tx, ty);
				if (!R && (k === "#" || k === "+")) R = roomAt(Math.floor((wx + (wx % 16 < 8 ? -8 : 8)) / 16), ty);
				if (!R) continue;
				let col = floorColor(R.floor, wx, wy);
				const yy = Y(wy), fy = yy - floorTop(R.band);
				if (fy < 4) col = col.map((v) => v * (.72 + fy * .07));
				const o = (Math.round(yy) * 384 + X(wx)) * 4;
				d[o] = col[0];
				d[o + 1] = col[1];
				d[o + 2] = col[2];
				d[o + 3] = 255;
			}
		}
		b.putImageData(img, 0, 0);
		rugs(b);
		return c;
	}
	function rugs(b) {
		const at = (tx, ty) => [X(tx * 16), Y(ty * 16)];
		const oval = (tx, ty, rx, ry, c1, c2, c3) => {
			const [x, y] = at(tx, ty);
			b.fillStyle = c3;
			b.beginPath();
			b.ellipse(x, y, rx + 2, ry + 2, 0, 0, 7);
			b.fill();
			b.fillStyle = c1;
			b.beginPath();
			b.ellipse(x, y, rx, ry, 0, 0, 7);
			b.fill();
			b.fillStyle = c2;
			b.beginPath();
			b.ellipse(x, y, rx * .6, ry * .6, 0, 0, 7);
			b.fill();
			b.fillStyle = c1;
			b.beginPath();
			b.ellipse(x, y, rx * .3, ry * .3, 0, 0, 7);
			b.fill();
		};
		oval(30, 7.3, 26, 11, "#5d7fb0", "#86a6d0", "#3f5f8c");
		oval(37, 7.3, 22, 11, "#d97a92", "#f2b0c0", "#b05a72");
		const [lx, ly] = at(40, 11), [lx2, ly2] = at(46, 14);
		b.fillStyle = "#e8c46a";
		b.fillRect(lx, ly, lx2 - lx, ly2 - ly);
		b.fillStyle = "#a83a42";
		b.fillRect(lx + 2, ly + 2, lx2 - lx - 4, ly2 - ly - 4);
		b.fillStyle = "#c4505a";
		for (let x = lx + 6; x < lx2 - 6; x += 8) for (let y = ly + 6; y < ly2 - 6; y += 8) b.fillRect(x, y, 3, 3);
		const [kx, ky] = at(29, 12.4), [kx2] = at(34, 12);
		b.fillStyle = "#7a5a3a";
		b.fillRect(kx, ky, kx2 - kx, 12);
		for (let x = kx + 1; x < kx2 - 1; x += 3) {
			b.fillStyle = x / 3 % 2 < 1 ? "#d8b07a" : "#5c8de0";
			b.fillRect(x, ky + 1, 2, 10);
		}
	}
	function walls(b) {
		const wood = "#7c4e30", top = "#b58a62", face = "#e8d6b4";
		for (const band of [0, 1]) {
			const ty0 = band === 0 ? 4 : 10;
			for (let tx = 26; tx < 50; tx++) {
				if (kind(tx, ty0) !== "#") continue;
				const x = X(tx * 16) + (tx === 26 ? 11 : tx === 49 ? 0 : 6), w = tx === 26 || tx === 49 ? 5 : 4;
				b.fillStyle = wood;
				b.fillRect(x, bandTop(band), w, floorTop(band) - bandTop(band));
				for (let ty = ty0; ty < ty0 + 5; ty++) {
					if (kind(tx, ty) === "+") {
						b.fillStyle = "#c8a777";
						b.fillRect(x - 2, Y(ty * 16), w + 4, 16);
						continue;
					}
					const y = Y(ty * 16);
					b.fillStyle = face;
					b.fillRect(x, y, w, 16);
					b.fillStyle = top;
					b.fillRect(x, y, w, 2);
					b.fillStyle = wood;
					b.fillRect(x, y, 1, 16);
					b.fillRect(x + w - 1, y, 1, 16);
				}
			}
		}
		for (const [ty, band] of [[9, 0], [15, 1]]) {
			const y = Y(ty * 16) + (band === 0 ? 0 : 0);
			for (let tx = 26; tx < 50; tx++) {
				const x = X(tx * 16);
				if (kind(tx, ty) === "+") {
					if (band === 1) b.drawImage(fussmatte, x, y + 2);
					continue;
				}
				b.fillStyle = "#5e3f28";
				b.fillRect(x, y, 16, 2);
				b.fillStyle = face;
				b.fillRect(x, y + 2, 16, 4);
				b.fillStyle = wood;
				b.fillRect(x, y + 7 - 1, 16, 1);
			}
		}
		for (let tx = 26; tx < 50; tx++) if (kind(tx, 9) === "+") {
			const x = X(tx * 16) + 2, y0 = bandTop(1) + 4, y1 = floorTop(1);
			b.fillStyle = "#5e3f28";
			b.fillRect(x - 1, y0 - 1, 14, y1 - y0 + 1);
			b.fillStyle = "#3a2a24";
			b.fillRect(x + 1, y0 + 1, 10, y1 - y0 - 1);
			b.fillStyle = "#c8a777";
			b.fillRect(x + 1, y1 - 2, 10, 2);
		}
	}
	var foot = (tx, ty) => [tx * 16 + 8, (ty + 1) * 16 - 1];
	var wand = (tx, band, spr, hoch = 8, licht) => ({
		x: tx * 16,
		y: bandTop(band) + hoch + spr.height,
		spr,
		wand: true,
		licht
	});
	function dinge() {
		const L = lit(), [st, sb] = SKY[zeit], out = [];
		const add = (tx, ty, spr, licht) => {
			const [x, y] = foot(tx, ty);
			out.push({
				x,
				y,
				spr,
				licht
			});
		};
		for (const o of objects) {
			if (o.kind === "door") continue;
			const key = o.kind === "bed" ? `bed|${accentOf(o.owner ?? "alex")}` : o.kind === "desk" ? "desk|0" : o.kind === "fireplace" || o.kind === "stove" ? `${o.kind}|${L ? 1 : 0}` : o.kind;
			add(o.tile[0], o.tile[1], objectSprite(key), o.kind === "fireplace" && L ? 1.3 : void 0);
		}
		for (const n of resources) {
			if (n.resource === "water") continue;
			add(n.tile[0], n.tile[1], n.resource === "food" ? korb : resourceSprite(`res|${n.resource}||5`));
		}
		const win = (r) => fenster(st, sb, CURTAIN[r], L);
		out.push(wand(29.4, 0, win("house.bedroom_a"), 6), wand(27.3, 0, bild("see"), 12), wand(36.4, 0, win("house.bedroom_b"), 6), wand(34.4, 0, bild("blume"), 11), wand(38.3, 0, wandregal("buecher"), 12), wand(44.3, 0, win("house.workshop"), 6), wand(41.4, 0, werkzeugwand, 9), wand(46.6, 0, win("house.workshop"), 6), wand(27.4, 1, toepfe, 8), wand(32.6, 1, wandregal("glaeser"), 10), wand(34.9, 1, uhr, 9), wand(38.6, 1, bild("portrait"), 10), wand(41.2, 1, spiegel, 9), wand(45.4, 1, wandregal("deko"), 12));
		add(29, 5, nachttisch(L), L ? .7 : void 0);
		add(32, 4, schrank);
		add(27, 8, pflanze(false));
		add(39, 4, stehlampe(L), L ? 1 : void 0);
		add(34, 8, katze);
		add(39, 8, pflanze(true));
		add(44, 7, saegebock);
		add(41, 8, kiste);
		add(42, 8, kiste);
		add(33, 10, kuechenzeile);
		add(30, 12, objectSprite("table"));
		add(37, 11, stehlampe(L), L ? 1 : void 0);
		add(45, 13, sessel("#5d8fb0"));
		add(37, 14, pflanze(true));
		add(44, 12, kerze, L ? .5 : void 0);
		return out;
	}
	function figuren() {
		const f = (id, tx, ty, dir, pose = "", werk) => ({
			x: tx * 16 + 8,
			y: (ty + 1) * 16 - (pose ? .5 : 2),
			hoch: pose ? 5 : 0,
			spr: figure(id, dir, "stand", pose),
			tool: werk ? tool(werk) : void 0
		});
		if (zeit === "Morgen") return [f("alex", 28, 12, "up"), f("mira", 38, 6, "up", "", "book")];
		if (zeit === "Mittag") return [f("alex", 43, 6, "up", "", "hammer"), f("mira", 31, 13, "left")];
		if (zeit === "Abend") return [f("mira", 39, 12, "down", "sit"), f("alex", 46, 13, "left")];
		return [{
			x: 456,
			y: 95.5,
			spr: sleeper("alex")
		}, {
			x: 568,
			y: 95.5,
			spr: sleeper("mira")
		}];
	}
	var baseC = null;
	var baseKey = "";
	var low = canvas(384, HEIGHT);
	function render() {
		if (baseKey !== zeit) {
			baseC = base();
			baseKey = zeit;
		}
		const b = low.getContext("2d"), m = TIMES[zeit], items = [...dinge(), ...figuren()];
		b.imageSmoothingEnabled = false;
		b.drawImage(baseC, 0, 0);
		for (const it of items.filter((i) => i.wand)) b.drawImage(it.spr, Math.round(X(it.x)), Math.round(it.y - it.spr.height));
		if (!lit()) for (const it of items.filter((i) => i.wand && i.spr.width === 22)) {
			const x = X(it.x), y = floorTop(it.y < floorTop(1) ? 0 : 1);
			b.globalCompositeOperation = "lighter";
			b.fillStyle = zeit === "Morgen" ? "rgba(255,210,150,0.14)" : "rgba(255,240,200,0.12)";
			b.beginPath();
			b.moveTo(x + 3, y);
			b.lineTo(x + 19, y);
			b.lineTo(x + 30, y + 40);
			b.lineTo(x + 8, y + 40);
			b.fill();
			b.globalCompositeOperation = "source-over";
		}
		walls(b);
		for (const it of items.filter((i) => !i.wand).sort((a, c) => a.y - c.y)) {
			const x = Math.round(X(it.x) - it.spr.width / 2), y = Math.round(Y(it.y) - it.spr.height - (it.hoch ?? 0));
			b.fillStyle = "rgba(40,24,30,0.22)";
			b.beginPath();
			b.ellipse(X(it.x) + 1, Y(it.y), it.spr.width * .42, Math.max(1.5, it.spr.width * .12), 0, 0, 7);
			b.fill();
			b.drawImage(it.spr, x, y);
			if (it.tool) b.drawImage(it.tool, x + 10, y + 9);
		}
		const W = cv.width, H = cv.height, R = ROOMS.find((r) => r.id === raum);
		const box = variante === "haus" ? {
			x: 0,
			y: 0,
			w: 384,
			h: HEIGHT
		} : {
			x: X(R.r[0] * 16) - 10,
			y: bandTop(R.band),
			w: R.r[2] * 16 + 20,
			h: Y((R.r[1] + R.r[3]) * 16) + 7 + 2 - bandTop(R.band)
		};
		const z = Math.max(1, Math.floor(Math.min(W / box.w, (H - 70 * dpr) / box.h))), ox = Math.round((W - box.w * z) / 2), oy = Math.round((H - box.h * z) / 2 + 20 * dpr);
		g.setTransform(1, 0, 0, 1, 0, 0);
		g.imageSmoothingEnabled = false;
		g.fillStyle = "#1a1322";
		g.fillRect(0, 0, W, H);
		g.save();
		g.beginPath();
		g.rect(ox, oy, box.w * z, box.h * z);
		g.clip();
		g.drawImage(low, ox - box.x * z, oy - box.y * z, 384 * z, HEIGHT * z);
		const grade = lit() ? m.grade.map((c, i) => c + ([
			255,
			226,
			190
		][i] - c) * .45) : m.grade;
		if (grade.some((c) => c < 255)) {
			g.globalCompositeOperation = "multiply";
			g.fillStyle = css(grade);
			g.fillRect(ox, oy, box.w * z, box.h * z);
		}
		g.globalCompositeOperation = "lighter";
		for (const it of items) if (it.licht) {
			const x = ox + (X(it.x) - box.x) * z, y = oy + ((it.wand ? it.y : Y(it.y)) - box.y - it.spr.height * .7) * z, r = 30 * z * it.licht;
			const rg = g.createRadialGradient(x, y, 0, x, y, r);
			rg.addColorStop(0, "rgba(255,200,120,0.55)");
			rg.addColorStop(.4, "rgba(255,170,90,0.2)");
			rg.addColorStop(1, "rgba(255,150,80,0)");
			g.fillStyle = rg;
			g.fillRect(x - r, y - r, 2 * r, 2 * r);
		}
		g.globalCompositeOperation = "source-over";
		const vg = g.createRadialGradient(W / 2, H * .55, H * .35, W / 2, H * .55, H * .9);
		vg.addColorStop(0, "rgba(30,20,40,0)");
		vg.addColorStop(1, zeit === "Nacht" ? "rgba(5,8,25,0.5)" : "rgba(40,25,40,0.3)");
		g.fillStyle = vg;
		g.fillRect(0, 0, W, H);
		g.restore();
		g.font = `600 ${11 * dpr}px ui-rounded, system-ui, sans-serif`;
		g.textBaseline = "middle";
		for (const r of ROOMS) {
			if (variante === "raum" && r.id !== raum) continue;
			const t = r.name, w = g.measureText(t).width + 12 * dpr, x = ox + (X((r.r[0] + r.r[2] / 2) * 16) - box.x) * z - w / 2, y = oy + (Y((r.r[1] + r.r[3]) * 16) - box.y) * z - 22 * dpr;
			g.fillStyle = "rgba(43,34,51,0.72)";
			g.beginPath();
			g.roundRect(x, y, w, 16 * dpr, 5 * dpr);
			g.fill();
			g.fillStyle = "#fff8ec";
			g.fillText(t, x + 6 * dpr, y + 8 * dpr);
		}
	}
	function resize() {
		cv.width = innerWidth * dpr;
		cv.height = innerHeight * dpr;
		cv.style.width = `${innerWidth}px`;
		cv.style.height = `${innerHeight}px`;
		render();
	}
	function ui() {
		document.querySelectorAll("[data-zeit]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zeit === zeit)));
		document.querySelectorAll("[data-variante]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.variante === variante)));
		document.querySelectorAll("[data-raum]").forEach((b) => {
			b.setAttribute("aria-pressed", String(b.dataset.raum === raum));
			b.hidden = variante !== "raum";
		});
		render();
	}
	var tabs = document.getElementById("raeume");
	for (const r of ROOMS) {
		const b = document.createElement("button");
		b.dataset.raum = r.id;
		b.textContent = r.name;
		tabs.appendChild(b);
	}
	document.addEventListener("click", (e) => {
		const b = e.target.closest("button");
		if (!b) return;
		if (b.dataset.zeit) zeit = b.dataset.zeit;
		if (b.dataset.variante) variante = b.dataset.variante;
		if (b.dataset.raum) raum = b.dataset.raum;
		ui();
	});
	addEventListener("resize", resize);
	resize();
	ui();
	document.body.dataset.ready = "1";
	window.__innen = { set: (z, v, r) => {
		zeit = z;
		variante = v;
		if (r) raum = r;
		ui();
	} };
	//#endregion
})();
