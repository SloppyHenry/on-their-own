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
	var ROWS = [
		"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
		"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
		"TT.............................T..............................TT",
		"TTT................T.................................T........TT",
		"TT..########################..................................TT",
		"TT..#______#______#________#..................................TT",
		"TT..#______#______#________#..................................TT",
		"TT..#______#______#________+,,................................TT",
		"TT..#______#______#________#..................................TT",
		"TT..#______#______#________#.............................T....TT",
		"TT..####+####+########+#####..................................TT",
		"TT..#_________#____________#..................................TT",
		"TT..#_________#____________#..................................TT",
		"TT..#_________+____________#..................................TT",
		"TT..#_________#____________#..................................TT",
		"TT..#_________#____________#..................................TT",
		"TT..################+#######........,.........................TT",
		"TT..................,...............,..........T..............TT",
		"TT....T.............,...............,................T..T.....TT",
		"TTTT.T.TT.T.TT..TT..,...............,.........................TT",
		"TT...T.TTTT.T..T.TTT,...............,.........................TT",
		"TT..T..T..T....T.T..,.....,,,,,,,,,,,,,,,.T.........sssssss..TTT",
		"TTT.T....T........T.,.....,,,,,,,,,,,,,,,.....T...ss~~~~~~~ss.TT",
		"TT...T..T.TTT.TT..T.,.....,,,,,,,,,,,,,,,........s~~~~~~~~~~~sTT",
		"TT..........TTT..TT.,.....,,,,,,,,,,,,,,,.......s~~~~~~~~~~~~~TT",
		"TTT.............T.TT,,,,,,,,,,,,,,,,,,,,,,,,,,,s~~~~~~~~~~~~~~TT",
		"TTTTTT,,,,,,,,,,,,,,,.....,,,,,,,,,,,,,,,......s~~~~~~~~~~~~~~TT",
		"TT.TTT......TTTT.TT.......,,,,,,,,,,,,,,,.....ss~~~~~~~~~~~~~~TT",
		"TT.T.T......T...TT........,,,,,,,,,,,,,,,....._______~~~~~~~~~TT",
		"TT..........T......T......,,,,,,,,,,,,,,,.....ss~~~~~~~~~~~~~~TT",
		"TTTTTT......T.....T............................s~~~~~~~~~~~~~~TT",
		"TTT......TTT..T...T............................s~~~~~~~~~~~~~~TT",
		"TTTT.......TTTT.T.T...............T.............s~~~~~~~~~~~~~TT",
		"TTT........T.TT.T.....................T.....T....s~~~~~~~~~~~sTT",
		"TTT...T.TT......................................T.ss~~~~~~~ss.TT",
		"TT.......T...TT.TTT.................................sssssss...TT",
		"TT..T..T..T.....T..T..........................................TT",
		"TTTT.T..TT..T...TTT....T......................................TT",
		"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
		"TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT"
	];
	/** Grundriss des Hauses in Kacheln (x1, y1 ausschließlich); draußen steht dort das Haus aus Mockup A auf einer Wiese. */
	var BLD = {
		x0: 4,
		y0: 4,
		x1: 28,
		y1: 17
	};
	var FRONT = {
		tx: 20,
		ty: 16
	};
	var DOOR = {
		x: FRONT.tx * 16 + 8,
		y: BLD.y1 * 16
	};
	var GARDEN = [
		30,
		4,
		17,
		12
	];
	var SQUARE = [
		26,
		21,
		15,
		9
	];
	var SEED = [
		[32, 7],
		[34, 7],
		[36, 7],
		[32, 10],
		[34, 10],
		[36, 10]
	];
	var ROOMS = [
		{
			id: "bedroom_a",
			name: "Zimmer Alex",
			r: [
				5,
				5,
				6,
				5
			],
			floor: "holz"
		},
		{
			id: "bedroom_b",
			name: "Zimmer Mira",
			r: [
				12,
				5,
				6,
				5
			],
			floor: "holz"
		},
		{
			id: "workshop",
			name: "Werkstatt",
			r: [
				19,
				5,
				8,
				5
			],
			floor: "werkstatt"
		},
		{
			id: "kitchen",
			name: "Küche",
			r: [
				5,
				11,
				9,
				5
			],
			floor: "fliesen"
		},
		{
			id: "living",
			name: "Wohnzimmer",
			r: [
				15,
				11,
				12,
				5
			],
			floor: "holz"
		}
	];
	var RUG = [
		18,
		12,
		6,
		3
	];
	var inRect = (r, tx, ty) => tx >= r[0] && ty >= r[1] && tx < r[0] + r[2] && ty < r[1] + r[3];
	var inBld = (tx, ty) => tx >= BLD.x0 && ty >= BLD.y0 && tx < BLD.x1 && ty < BLD.y1;
	/** Kachelzeichen; außerhalb der Karte Wald. */
	function raw(tx, ty) {
		if (tx < 0 || ty < 0 || tx >= 64 || ty >= 40) return "T";
		return ROWS[ty][tx];
	}
	/** Draußen ist der Grundriss Wiese ('Y'), damit Weg und Platz nicht unter dem Haus hindurchlaufen. */
	var outside = (tx, ty) => inBld(tx, ty) ? "Y" : raw(tx, ty);
	function walkable(tx, ty, inside) {
		const c = raw(tx, ty);
		if (inside) return inBld(tx, ty) && (c === "_" || c === "+");
		return !inBld(tx, ty) && c !== "T" && c !== "~";
	}
	/** Breitensuche über Kacheln, 8 Richtungen ohne Eckenschneiden. */
	function findPath(from, tx, ty) {
		const inside = from.inside;
		if (!walkable(tx, ty, inside)) return null;
		const W = 64, prev = (/* @__PURE__ */ new Int32Array(2560)).fill(-1), start = from.ty * W + from.tx, goal = ty * W + tx, q = [start];
		prev[start] = start;
		const D = [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1]
		];
		for (let h = 0; h < q.length; h++) {
			const c = q[h], cx = c % W, cy = c / W | 0;
			if (c === goal) break;
			for (const [dx, dy] of D) {
				const nx = cx + dx, ny = cy + dy, n = ny * W + nx;
				if (nx < 0 || ny < 0 || nx >= 64 || ny >= 40 || prev[n] >= 0 || !walkable(nx, ny, inside)) continue;
				if (dx && dy && (!walkable(cx + dx, cy, inside) || !walkable(cx, cy + dy, inside))) continue;
				prev[n] = c;
				q.push(n);
			}
		}
		if (prev[goal] < 0) return null;
		const out = [];
		for (let c = goal; c !== start; c = prev[c]) out.push({
			tx: c % W,
			ty: c / W | 0,
			inside
		});
		return out.reverse();
	}
	/** Weg auch durch die Haustür: drinnen bis zur Tür, dann draußen weiter (oder umgekehrt). */
	function route(from, tx, ty, inside) {
		if (from.inside === inside) return findPath(from, tx, ty);
		const door = {
			tx: FRONT.tx,
			ty: FRONT.ty,
			inside: true
		}, yard = {
			tx: FRONT.tx,
			ty: FRONT.ty + 1,
			inside: false
		};
		const a = findPath(from, from.inside ? door.tx : yard.tx, from.inside ? door.ty : yard.ty);
		const b = findPath(from.inside ? yard : door, tx, ty);
		if (!a || !b) return null;
		return [
			...a,
			from.inside ? yard : door,
			...b
		];
	}
	/** Zufälliges begehbares Ziel in der Nähe (für das Herumschlendern). */
	function nearby(from, r, R) {
		for (let i = 0; i < 30; i++) {
			const tx = from.tx + Math.round((R() - .5) * 2 * r), ty = from.ty + Math.round((R() - .5) * 2 * r);
			if (walkable(tx, ty, from.inside)) return {
				tx,
				ty,
				inside: from.inside
			};
		}
		return null;
	}
	//#endregion
	//#region ../docs/mockups/welt-optik/ruhig/boden.ts
	var GW = 1664;
	var GH = 1280;
	var inPx = (r, x, y) => x >= r[0] * 16 && y >= r[1] * 16 && x < (r[0] + r[2]) * 16 && y < (r[1] + r[3]) * 16;
	var C = (r, g, b) => [
		r,
		g,
		b
	];
	var FLOOR = {
		tileA: C(233, 226, 211),
		tileB: C(207, 199, 184),
		ws1: C(110, 80, 56),
		ws2: C(140, 106, 76),
		ws3: C(128, 96, 74),
		plank2: C(195, 134, 79),
		wallTop: C(139, 109, 85),
		rugA: C(196, 80, 90),
		rugB: C(168, 64, 76),
		rugEdge: C(242, 210, 138)
	};
	var DIST = (() => {
		const d = /* @__PURE__ */ new Float32Array(2560), q = [];
		for (let y = 0; y < 40; y++) for (let x = 0; x < 64; x++) {
			const w = raw(x, y) === "~";
			d[y * 64 + x] = w ? 1e9 : 0;
			if (!w) q.push([x, y]);
		}
		for (let h = 0; h < q.length; h++) {
			const [px, py] = q[h];
			for (const [ox, oy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) {
				const a = px + ox, b = py + oy;
				if (a < 0 || b < 0 || a >= 64 || b >= 40) continue;
				const k = b * 64 + a;
				if (d[k] > d[py * 64 + px] + 1) {
					d[k] = d[py * 64 + px] + 1;
					q.push([a, b]);
				}
			}
		}
		return d;
	})();
	function dist(x, y) {
		const fx = x / 16 - .5, fy = y / 16 - .5, x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
		const at = (a, b) => a < 0 || b < 0 || a >= 64 || b >= 40 ? 0 : DIST[b * 64 + a];
		return (at(x0, y0) * (1 - u) + at(x0 + 1, y0) * u) * (1 - v) + (at(x0, y0 + 1) * (1 - u) + at(x0 + 1, y0 + 1) * u) * v - .5;
	}
	function texel(px, py) {
		const wx = px - 320, wy = py - 320, n = noise(px * .13, py * .13, 1), h = hash(px, py, 2), g = n * .75 + h * .25;
		const qx = wx + (noise(wx * .07, wy * .07, 21) - .5) * 12, qy = wy + (noise(wx * .07, wy * .07, 22) - .5) * 12;
		const r = outside(Math.floor(wx / 16), Math.floor(wy / 16)), ch = outside(Math.floor(qx / 16), Math.floor(qy / 16));
		if (r === "_") {
			const dy = wy - 448;
			return [wx % 4 === 3 ? WPA.wood3 : dy === 0 || dy === 15 ? WPA.wood2 : h < .5 ? WPA.wood1 : WPA.wood2, 5];
		}
		if (ch === "T" && r === "T") return [g < .36 ? WPA.wild3 : g < .66 ? WPA.wild2 : WPA.wild1, 7];
		let col = g < .32 ? WPA.grass3 : g < .64 ? WPA.grass2 : WPA.grass1, type = 0;
		if ((px + py * 2) % 9 === 0 && h > .55) col = WPA.grassLight;
		if (ch === "~") {
			const lv = dist(qx, qy);
			return [lv < .12 ? WPA.foam : lv < .6 ? WPA.water1 : lv < 1.3 ? WPA.water2 : lv < 2.4 ? WPA.water3 : WPA.waterDeep, 2];
		}
		if (ch === "s") return [h < .5 ? WPA.path1 : WPA.path2, 6];
		if (inPx(SQUARE, qx, qy)) {
			if (!inPx(SQUARE, qx - 3, qy) || !inPx(SQUARE, qx + 3, qy) || !inPx(SQUARE, qx, qy - 3) || !inPx(SQUARE, qx, qy + 3)) return [WPA.stone3, 3];
			const row = Math.floor(wy / 4), off = row & 1 ? 2 : 0, cx = Math.floor((wx + off) / 5);
			if (wy % 4 === 0 || (wx + off) % 5 === 0) return [WPA.cob3, 3];
			if (wy % 4 === 1 && (wx + off) % 5 === 1) return [WPA.cobHi, 3];
			return [hash(cx, row, 9) < .35 ? WPA.cob2 : WPA.cob1, 3];
		}
		if (ch === ",") return [noise(px * .3, py * .3, 4) < .45 ? WPA.path2 : h > .965 ? WPA.pebble : WPA.path1, 1];
		if ([
			[3, 0],
			[-3, 0],
			[0, 3],
			[0, -3]
		].some(([ox, oy]) => outside(Math.floor((qx + ox) / 16), Math.floor((qy + oy) / 16)) === ",")) col = WPA.grassDark;
		if (inPx(GARDEN, wx, wy) && col !== WPA.grassDark) {
			col = g < .5 ? WPA.grass1 : WPA.grassLight;
			for (const [sx, sy] of SEED) {
				const bx = wx - sx * 16, by = wy - sy * 16;
				if (bx >= -6 && bx < 22 && by >= 3 && by < 13) {
					type = 4;
					col = (by - 3) % 3 === 0 ? WPA.soil2 : WPA.soil1;
					if (bx === -6 || bx === 21 || by === 12) col = WPA.wood3;
				}
			}
		}
		if (Math.abs(wx - DOOR.x) < 36 && wy >= DOOR.y - 30 && wy < DOOR.y) col = WPA.path3;
		return [col, type];
	}
	/** Boden draußen mit Grasbüscheln, Blumen, Wasserglanz und eingebackenen Schatten der festen Dinge. */
	function groundTexture(shadows) {
		const c = canvas(GW, GH), g = c.getContext("2d"), img = g.createImageData(GW, GH), d = img.data, ty = new Uint8Array(GW * GH);
		for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
			const [col, t] = texel(x, y), o = (y * GW + x) * 4;
			let [r, gg, b] = col;
			if (t === 2 && Math.sin(x * .55 + 2.1) * Math.sin(y * 1.25 - 1.6) > .86) {
				r = 240;
				gg = 252;
				b = 255;
			}
			d[o] = r;
			d[o + 1] = gg;
			d[o + 2] = b;
			d[o + 3] = 255;
			ty[y * GW + x] = t;
		}
		const set = (x, y, col) => {
			if (x < 0 || y < 0 || x >= GW || y >= GH) return;
			const o = (y * GW + x) * 4;
			d[o] = col[0];
			d[o + 1] = col[1];
			d[o + 2] = col[2];
		};
		const typeAt = (x, y) => x < 0 || y < 0 || x >= GW || y >= GH ? 255 : ty[y * GW + x];
		const R = rng(5), k = GW * GH / 110592;
		for (let i = 0; i < 1400 * k; i++) {
			const x = Math.floor(R() * GW), y = Math.floor(R() * GH), t = typeAt(x, y);
			if (t === 0 || t === 7) {
				const dk = t === 7 ? WPA.wild3 : WPA.grassDark;
				set(x, y - 1, dk);
				set(x - 1, y, dk);
				set(x + 1, y, dk);
			}
		}
		const FL = [
			WPA.fP,
			WPA.fY,
			WPA.fW,
			WPA.fB
		];
		for (let i = 0; i < 260 * k; i++) {
			const fx = Math.floor(R() * GW), fy = Math.floor(R() * GH), fc = FL[Math.floor(R() * 4)], big = R() < .35, n2 = 2 + Math.floor(R() * 4);
			for (let j = 0; j < n2; j++) {
				const a = fx + Math.round((R() - .5) * 9), b = fy + Math.round((R() - .5) * 7);
				if (typeAt(a, b) !== 0) continue;
				if (big) {
					set(a - 1, b, fc);
					set(a + 1, b, fc);
					set(a, b - 1, fc);
					set(a, b + 1, fc);
					set(a, b, WPA.fY);
				} else set(a, b, fc);
			}
		}
		for (const s of shadows) {
			const rx = s.w * .42, ry = Math.max(2, s.w * .16), cx = s.x + 320 + rx * .3, cy = s.y + 320 + .5;
			for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
				const ex = (x + .5 - cx) / rx, ey = (y + .5 - cy) / ry;
				if (ex * ex + ey * ey > 1 || x < 0 || y < 0 || x >= GW || y >= GH) continue;
				const o = (y * GW + x) * 4;
				d[o] *= .72;
				d[o + 1] *= .72 * 1.02;
				d[o + 2] *= .8064;
			}
		}
		g.putImageData(img, 0, 0);
		return c;
	}
	/** Innenboden des Hauses (Grundriss in Weltpixeln ab BLD.x0/y0): Dielen, Werkstattbretter, Küchenfliesen, Teppich, Schwellen. */
	function floorTexture() {
		const w = (BLD.x1 - BLD.x0) * 16, h = (BLD.y1 - BLD.y0) * 16, c = canvas(w, h), g = c.getContext("2d"), img = g.createImageData(w, h), d = img.data;
		for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
			const wx = x + BLD.x0 * 16, wy = y + BLD.y0 * 16, tx = Math.floor(wx / 16), ty = Math.floor(wy / 16), ch = raw(tx, ty), hh = hash(wx, wy, 2);
			const lx = wx % 16, ly = wy % 16, room = ROOMS.find((r) => inRect(r.r, tx, ty));
			let col;
			if (ch === "#") col = FLOOR.wallTop;
			else if (ch === "+") col = ly % 4 === 0 ? WPA.wood3 : WPA.wood1;
			else if (inRect(RUG, tx, ty)) col = tx === RUG[0] && lx < 2 || tx === RUG[0] + RUG[2] - 1 && lx > 13 || ty === RUG[1] && ly < 2 || ty === RUG[1] + RUG[3] - 1 && ly > 13 ? FLOOR.rugEdge : (wx + wy + tx + ty) % 6 < 3 ? FLOOR.rugA : FLOOR.rugB;
			else if (room?.floor === "fliesen") col = Math.floor(wx / 8) + Math.floor(wy / 8) & 1 ? FLOOR.tileA : FLOOR.tileB;
			else if (room?.floor === "werkstatt") col = wy % 5 === 0 ? FLOOR.ws1 : hh < .5 ? FLOOR.ws2 : FLOOR.ws3;
			else col = wy % 4 === 0 ? WPA.wood3 : Math.floor(wx / 12 + Math.floor(wy / 4) * .5) & 1 ? WPA.wood1 : FLOOR.plank2;
			const o = (y * w + x) * 4;
			d[o] = col[0];
			d[o + 1] = col[1];
			d[o + 2] = col[2];
			d[o + 3] = 255;
		}
		g.putImageData(img, 0, 0);
		return c;
	}
	//#endregion
	//#region src/world/art/nature.ts
	function tree(variant, seed) {
		return sprite(32, 42, (s) => {
			let R = rng(seed);
			s.r(14, 28, 5, 12, WP.trunk1);
			s.r(17, 28, 2, 12, WP.trunk2);
			s.r(12, 38, 9, 2, WP.trunk2);
			s.p(13, 37, WP.trunk1);
			let L = variant === 2 ? [
				"#ffc6da",
				"#f7a0c0",
				"#e27da5",
				"#be5f88"
			] : [
				WP.leaf1,
				WP.leaf2,
				WP.leaf3,
				WP.leaf4
			];
			s.disc(16, 17, 13, L[3]);
			s.disc(9, 21, 7.5, L[3]);
			s.disc(23, 21, 7.5, L[3]);
			s.disc(15, 15, 11.5, L[2]);
			s.disc(9, 19, 6.2, L[2]);
			s.disc(22.5, 19, 6, L[2]);
			s.disc(14, 13, 9, L[1]);
			s.disc(20, 12, 5, L[1]);
			s.disc(8, 16, 4, L[1]);
			s.disc(12, 9, 4.6, L[0]);
			s.disc(18, 8, 2.6, L[0]);
			for (let k = 0; k < 34; k++) {
				let a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 11, x = Math.round(16 + Math.cos(a) * rr), y = Math.round(16 + Math.sin(a) * rr * .9);
				let shade = y > 16 ? L[3] : L[2];
				s.p(x, y, shade);
				s.p(x + 1, y, shade);
				s.p(x - 1, y - 1, y > 14 ? L[2] : L[0]);
			}
			if (variant === 1) for (let f = 0; f < 7; f++) {
				let ax = Math.round(7 + R() * 18), ay = Math.round(9 + R() * 14);
				s.r(ax, ay, 2, 2, WP.fR);
				s.p(ax, ay, "#ffd0c8");
			}
			if (variant === 2) for (let q = 0; q < 10; q++) s.p(Math.round(6 + R() * 20), Math.round(6 + R() * 18), WP.fW);
			s.outline(WP.outline);
		});
	}
	function pine(_seed) {
		return sprite(26, 46, (s) => {
			let C = [
				"#62b071",
				"#47975e",
				"#337b52",
				"#245f45"
			];
			s.r(11, 36, 4, 9, WP.trunk1);
			s.r(13, 36, 2, 9, WP.trunk2);
			for (let i = 0; i < 4; i++) {
				let top = 2 + i * 8, hw = 4 + i * 3, hgt = 13;
				for (let y = 0; y < hgt; y++) {
					let half = Math.round(hw * (y + 1) / hgt + 1);
					for (let x = -half; x <= half; x++) s.p(13 + x, top + y, x < -half / 3 ? C[0] : x < half / 3 ? C[1] : C[2]);
					s.p(13 - half, top + y, C[1]);
				}
				for (let x2 = -hw - 1; x2 <= hw + 1; x2 += 2) s.p(13 + x2, top + hgt - 1, C[3]);
			}
			s.outline(WP.outline);
		});
	}
	function bush(seed, flowers) {
		return sprite(20, 14, (s) => {
			let R = rng(seed);
			s.ell(10, 8, 8.5, 5.5, WP.leaf4);
			s.ell(9, 7, 7.5, 4.6, WP.leaf3);
			s.ell(8, 6, 5, 3, WP.leaf2);
			s.ell(7, 5, 2.5, 1.5, WP.leaf1);
			if (flowers) for (let i = 0; i < 6; i++) {
				let x = Math.round(3 + R() * 14), y = Math.round(3 + R() * 7);
				s.p(x, y, flowers);
				s.p(x, y - 1, WP.fW);
			}
			s.outline(WP.outline);
		});
	}
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
	function rock(_seed) {
		return sprite(12, 9, (s) => {
			s.ell(6, 5, 5, 3.5, WP.stone2);
			s.ell(5, 4, 3.5, 2.2, WP.stone1);
			s.p(4, 3, "#efeae2");
			s.outline(WP.outline);
		});
	}
	function reed() {
		return sprite(8, 13, (s) => {
			s.r(2, 3, 1, 9, WP.leaf3);
			s.r(4, 1, 1, 11, WP.leaf2);
			s.r(6, 4, 1, 8, WP.leaf3);
			s.r(4, 1, 1, 4, "#8a5a35");
			s.outline(WP.outline);
		});
	}
	//#endregion
	//#region src/world/art/village.ts
	function house(lit) {
		return sprite(78, 80, (s) => {
			let y, x;
			s.r(55, 1, 8, 18, WP.stone2);
			s.r(55, 1, 3, 18, WP.stone1);
			s.r(54, 0, 10, 3, WP.stone3);
			for (y = 5; y < 18; y += 4) s.r(55, y, 8, 1, WP.stone3);
			for (y = 6; y <= 34; y++) {
				let l = Math.round(13 - (y - 6) * 11 / 28), r = Math.round(65 + (y - 6) * 11 / 28), row = (y - 6) % 5;
				for (x = l; x <= r; x++) {
					let c = row < 2 ? WP.roof1 : WP.roof2;
					if (row === 4 && (x + Math.floor((y - 6) / 5) * 3) % 6 === 0) c = WP.roof3;
					if (row === 4 && (x + Math.floor((y - 6) / 5) * 3) % 6 === 1) c = WP.roof3;
					if (x === l || x === r) c = WP.roof3;
					s.p(x, y, c);
				}
			}
			s.r(13, 5, 53, 2, WP.roof3);
			s.r(14, 4, 51, 1, WP.wood3);
			s.r(2, 34, 75, 2, WP.roof3);
			s.disc(39.5, 20.5, 5.5, WP.wood3);
			s.disc(39.5, 20.5, 4.2, lit ? WP.glassLit : WP.glass);
			s.r(39, 16, 1, 9, WP.wood1);
			s.r(35, 20, 9, 1, WP.wood1);
			if (!lit) {
				s.p(37, 18, "#e9f8ff");
				s.p(38, 17, "#e9f8ff");
			}
			s.r(6, 36, 66, 36, WP.wall1);
			for (y = 37; y < 72; y += 3) for (x = 7; x < 72; x += 7) if (hash(x, y, 3) > .7) s.p(x, y, WP.wall2);
			s.r(6, 36, 66, 2, WP.wall3);
			s.r(6, 36, 2, 36, WP.wood2);
			s.r(37, 36, 2, 12, WP.wood2);
			s.r(70, 36, 2, 36, WP.wood2);
			s.r(6, 54, 66, 2, WP.wood2);
			let wins = [[13, 40], [50, 40]];
			for (let i = 0; i < wins.length; i++) {
				let wx = wins[i][0], wy = wins[i][1];
				s.r(wx - 1, wy - 1, 17, 14, WP.wood3);
				s.r(wx, wy, 15, 12, lit ? WP.glassLit : WP.glass);
				s.r(wx + 7, wy, 1, 12, WP.wood1);
				s.r(wx, wy + 5, 15, 1, WP.wood1);
				if (!lit) {
					s.p(wx + 1, wy + 1, "#eefaff");
					s.p(wx + 2, wy + 1, "#eefaff");
					s.p(wx + 1, wy + 2, "#eefaff");
					s.p(wx + 9, wy + 7, "#eefaff");
				} else s.r(wx + 1, wy + 7, 5, 4, "#ffc46a");
				s.r(wx - 2, wy + 12, 19, 4, WP.wood2);
				s.r(wx - 2, wy + 12, 19, 1, WP.wood1);
				for (let f = 0; f < 7; f++) {
					let fx = wx - 1 + f * 2.6;
					s.p(fx, wy + 11, WP.leaf3);
					s.p(fx + 1, wy + 10, [
						WP.fP,
						WP.fY,
						WP.fW,
						WP.fR
					][f % 4]);
					s.p(fx, wy + 10, WP.leaf2);
				}
			}
			s.r(32, 52, 14, 20, WP.wood3);
			s.disc(39, 53, 7, WP.wood3);
			s.r(33, 53, 12, 19, WP.wood1);
			s.disc(39, 54, 6, WP.wood1);
			for (x = 35; x < 45; x += 3) s.r(x, 50, 1, 22, WP.wood2);
			s.r(42, 62, 2, 2, WP.fY);
			s.r(48, 46, 4, 6, WP.outline);
			s.r(49, 47, 2, 4, lit ? WP.lampLit : WP.lamp);
			for (x = 6; x < 72; x += 5) {
				s.r(x, 72, 5, 4, hash(x, 1, 4) < .5 ? WP.stone1 : WP.stone2);
				s.p(x, 72, WP.stone3);
			}
			s.r(6, 72, 66, 1, WP.stone3);
			s.r(30, 76, 18, 3, WP.stone1);
			s.r(30, 78, 18, 1, WP.stone2);
			s.outline(WP.outline);
		});
	}
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
	function lamp(lit) {
		return sprite(10, 30, (s) => {
			s.r(4, 9, 2, 19, "#4b4559");
			s.r(2, 27, 6, 2, "#4b4559");
			s.r(2, 2, 6, 7, "#4b4559");
			s.r(3, 3, 4, 5, lit ? WP.lampLit : WP.lamp);
			s.r(1, 1, 8, 1, "#4b4559");
			s.r(3, 0, 4, 1, "#4b4559");
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
	function fence() {
		return sprite(14, 11, (s) => {
			s.r(1, 3, 3, 7, WP.wood1);
			s.p(2, 2, WP.wood1);
			s.r(3, 3, 1, 7, WP.wood2);
			s.r(10, 3, 3, 7, WP.wood1);
			s.p(11, 2, WP.wood1);
			s.r(12, 3, 1, 7, WP.wood2);
			s.r(0, 4, 14, 1, WP.wood1);
			s.r(0, 7, 14, 1, WP.wood1);
			s.r(0, 5, 14, 1, WP.wood2);
			s.outline(WP.outline);
		});
	}
	function post() {
		return sprite(5, 11, (s) => {
			s.r(1, 2, 3, 8, WP.wood1);
			s.p(2, 1, WP.wood1);
			s.r(3, 2, 1, 8, WP.wood2);
			s.outline(WP.outline);
		});
	}
	function scarecrow() {
		return sprite(18, 26, (s) => {
			s.r(8, 9, 2, 16, WP.wood2);
			s.r(2, 12, 14, 2, WP.wood2);
			s.r(4, 11, 10, 7, "#5f86c4");
			s.r(7, 13, 3, 3, "#e2b25c");
			s.disc(9, 7, 3.6, "#e9d3a2");
			s.p(8, 7, WP.outline);
			s.p(10, 7, WP.outline);
			s.r(3, 3, 12, 2, "#e8b947");
			s.r(6, 0, 6, 3, "#e8b947");
			s.r(6, 2, 6, 1, "#c79531");
			s.p(1, 12, "#e8b947");
			s.p(16, 12, "#e8b947");
			s.outline(WP.outline);
		});
	}
	function sign() {
		return sprite(16, 18, (s) => {
			s.r(7, 4, 2, 13, WP.wood3);
			s.r(1, 3, 11, 6, WP.wood1);
			s.p(12, 4, WP.wood1);
			s.r(12, 5, 2, 2, WP.wood1);
			s.p(12, 7, WP.wood1);
			s.r(3, 5, 6, 1, WP.wood3);
			s.r(3, 7, 4, 1, WP.wood3);
			s.outline(WP.outline);
		});
	}
	function mailbox() {
		return sprite(8, 14, (s) => {
			s.r(3, 6, 2, 7, WP.wood3);
			s.r(1, 1, 6, 5, "#e05a5a");
			s.r(1, 1, 6, 1, "#ff8a7a");
			s.p(6, 2, WP.fY);
			s.outline(WP.outline);
		});
	}
	function barrel() {
		return sprite(11, 13, (s) => {
			s.ell(5.5, 6, 4.5, 5.5, WP.wood1);
			s.r(1, 3, 9, 1, WP.wood3);
			s.r(1, 8, 9, 1, WP.wood3);
			s.ell(5.5, 1.6, 4, 1.3, WP.wood2);
			s.outline(WP.outline);
		});
	}
	function boat() {
		return sprite(24, 10, (s) => {
			s.ell(12, 4, 11, 4, WP.wood1);
			s.ell(12, 3.5, 9, 2.5, WP.wood3);
			s.r(11, 1, 2, 5, WP.wood2);
			s.r(1, 6, 22, 1, "#3fa4d3");
			s.r(3, 7, 18, 2, "#5cc2e3");
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
	//#endregion
	//#region ../docs/mockups/welt-optik/ruhig/dinge.ts
	var memo1 = (f) => {
		let c = null;
		return () => c ??= f();
	};
	var both = (f) => {
		const a = memo1(() => f(false)), b = memo1(() => f(true));
		return (lit) => lit ? b() : a();
	};
	var trees = /* @__PURE__ */ new Map();
	function treeOf(kind, seed) {
		const k = `${kind}|${seed % 7}`;
		if (!trees.has(k)) trees.set(k, kind === "pine" ? pine(seed % 7) : tree(kind === "treeF" ? 1 : kind === "treeB" ? 2 : 0, seed % 7 + 1));
		return trees.get(k);
	}
	var HOUSE$1 = both(house);
	var LAMP = both(lamp);
	var S = {
		well: () => memo1(well),
		bench: () => memo1(bench),
		board: () => memo1(() => board(2)),
		fence: () => memo1(fence),
		post: () => memo1(post),
		mailbox: () => memo1(mailbox),
		barrel: () => memo1(barrel),
		bushP: () => memo1(() => bush(5, WP.fP)),
		bushY: () => memo1(() => bush(6, WP.fY)),
		sign: () => memo1(sign),
		boat: () => memo1(boat),
		scare: () => memo1(scarecrow),
		sun: () => memo1(sunflower),
		reed: () => memo1(reed),
		tomato: (e) => memo1(() => tomato(e)),
		rock: (e) => memo1(() => rock(e))
	};
	var cache = /* @__PURE__ */ new Map();
	var spriteOf = (kind, extra) => {
		const k = `${kind}|${extra}`;
		if (!cache.has(k)) cache.set(k, S[kind](extra));
		return cache.get(k);
	};
	/** Draußen: Bäume auf Waldkacheln und jenseits der Karte, Haus, Brunnen, Bänke, Zaun, Deko wie in echt.js. */
	function outdoorItems() {
		const o = [], R = rng(11);
		const add = (kind, x, y, extra = 0) => o.push({
			kind,
			x: Math.round(x),
			y: Math.round(y),
			spr: spriteOf(kind, extra),
			shadow: kind !== "boat"
		});
		for (let y = -16; y < 56; y++) for (let x = -20; x < 84; x++) {
			if (outside(x, y) !== "T") continue;
			const hh = hash(x, y, 5), out = x < 0 || y < 0 || x >= 64 || y >= 40;
			if (out && hh < .25) continue;
			const spr = treeOf(hh < .45 ? "pine" : hh > .94 && !out ? "treeF" : hh > .9 && !out ? "treeB" : "tree", Math.abs(x * 7 + y));
			o.push({
				kind: "tree",
				x: Math.round(x * 16 + 8 + (hash(x, y, 6) - .5) * 8),
				y: Math.round((y + 1) * 16 - 2 + (hash(x, y, 7) - .5) * 6),
				spr: () => spr,
				shadow: true
			});
		}
		o.push({
			kind: "house",
			x: DOOR.x,
			y: DOOR.y,
			spr: HOUSE$1,
			shadow: true,
			light: [[0, .8]]
		});
		add("well", 648, 159);
		add("bench", 648, 207);
		add("well", 536, 415);
		add("bench", 488, 383);
		add("board", 616, 367);
		const [gx, gy, gw, gh] = GARDEN, gx0 = gx * 16, gx1 = (gx + gw) * 16, gy0 = gy * 16, gy1 = (gy + gh) * 16;
		for (let x = gx0; x < gx1 - 4; x += 12) {
			if (Math.abs(x + 7 - 584) > 9) add("fence", x + 7, gy1);
			add("fence", x + 7, gy0);
		}
		for (let y = gy0 + 8; y < gy1; y += 8) {
			if (y < 112 || y > 132) add("post", gx0, y);
			add("post", gx1, y);
		}
		const deco = [
			[
				"mailbox",
				DOOR.x + 30,
				DOOR.y + 6
			],
			[
				"barrel",
				DOOR.x - 52,
				DOOR.y - 4
			],
			[
				"barrel",
				DOOR.x - 45,
				DOOR.y - 2
			],
			[
				"bushP",
				DOOR.x - 24,
				DOOR.y + 6
			],
			[
				"bushY",
				DOOR.x + 18,
				DOOR.y + 6
			],
			[
				"sign",
				596,
				328
			],
			[
				"boat",
				880,
				468
			],
			[
				"scare",
				704,
				208
			],
			[
				"sun",
				500,
				96
			],
			[
				"sun",
				508,
				98
			],
			[
				"sun",
				516,
				96
			],
			[
				"tomato",
				624,
				128,
				1
			],
			[
				"tomato",
				638,
				130,
				2
			]
		];
		for (const [k, x, y, e] of deco) add(k, x, y, e ?? 0);
		for (const [x, y] of [
			[DOOR.x + 22, DOOR.y + 40],
			[416, 336],
			[656, 336],
			[736, 432]
		]) o.push({
			kind: "lamp",
			x,
			y,
			spr: LAMP,
			shadow: true,
			light: [[24, 1]]
		});
		for (let y = 18; y < 38; y++) for (let x = 44; x < 63; x++) {
			if (raw(x, y) === "~" || raw(x, y) === "T") continue;
			if ([
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			].some(([a, b]) => raw(x + a, y + b) === "~") && hash(x, y, 8) < .3) add("reed", x * 16 + 8, y * 16 + 10);
		}
		for (let i = 0; i < 40; i++) {
			const x = Math.floor(R() * 64), y = Math.floor(R() * 40);
			if (outside(x, y) === "." && R() < .5) add("rock", x * 16 + 8, y * 16 + 12, i);
		}
		return o;
	}
	/** Lichter am Haus (Fenster, Laterne an der Tür) relativ zur Tür wie E_HOUSE_LIGHTS: [dx, Höhe, Stärke]. */
	var HOUSE_LIGHTS = [
		[
			-17,
			32,
			1
		],
		[
			17,
			32,
			1
		],
		[
			0,
			59,
			.8
		],
		[
			9,
			31,
			.7
		]
	];
	/** Drinnen: Einrichtung aus world_default.json, Sprites aus things.ts; `lit` zündet den Kamin an. */
	function indoorItems() {
		const at = (kind, key, tx, ty) => {
			const k = typeof key === "string" ? () => key : key;
			return {
				kind,
				x: tx * 16 + 8,
				y: (ty + 1) * 16 - 1,
				spr: (lit) => objectSprite(k(lit))
			};
		};
		return [
			at("bed", `bed|${accentOf("alex")}`, 6, 6),
			at("chest", "chest", 10, 6),
			at("bed", `bed|${accentOf("mira")}`, 13, 6),
			at("desk", "desk|0", 16, 6),
			at("workbench", "workbench", 20, 6),
			at("axe", "axe", 22, 6),
			at("pickaxe", "pickaxe", 23, 6),
			at("stove", "stove|0", 6, 12),
			at("tap", "tap", 10, 15),
			at("sofa", "sofa", 17, 13),
			at("table", "table", 21, 13),
			at("bookshelf", "bookshelf", 25, 11),
			{
				...at("fireplace", (lit) => `fireplace|${lit ? 1 : 0}`, 26, 13),
				light: [[8, .9]]
			}
		];
	}
	/** Mauern drinnen „heruntergeklappt“: hinten (nach Norden) halbhoch, sonst nur ein Sockel, wie in der Innenansicht der App. */
	function walls() {
		const out = [];
		for (let ty = BLD.y0; ty < BLD.y1; ty++) for (let tx = BLD.x0; tx < BLD.x1; tx++) {
			if (raw(tx, ty) !== "#") continue;
			out.push({
				x: tx * 16,
				y: (ty + 1) * 16,
				back: ty === BLD.y0 || raw(tx, ty - 1) === "."
			});
		}
		return out;
	}
	/** Mauerstück zeichnen (Gerät-Pixel, Zoom z, Ursprung ox/oy); Stil wie wallPiece in der App. */
	function drawWall(g, w, z, ox, oy) {
		const h = w.back ? 22 : 5, x = ox + w.x * z, base = oy + w.y * z, top = base - h * z, cap = 16 * z;
		g.fillStyle = w.back ? "#f0e2c4" : WP.wall1;
		g.fillRect(x, top, 16 * z, h * z);
		if (w.back) {
			g.fillStyle = "#e8d6b4";
			g.fillRect(x, top, 16 * z, 5 * z);
		}
		g.fillStyle = w.back ? "#9a8a78" : WP.stone2;
		g.fillRect(x, base - 2 * z, 16 * z, 2 * z);
		g.fillStyle = WP.wood2;
		g.fillRect(x, top, 16 * z, z);
		g.fillStyle = "#b58a62";
		g.fillRect(x, top - cap, 16 * z, cap);
		g.fillStyle = WP.wood3;
		g.fillRect(x, top - cap, z, cap);
		g.fillRect(x, top - cap, 16 * z, z);
	}
	//#endregion
	//#region ../docs/mockups/welt-optik/ruhig/effekte.ts
	var Himmel = class {
		clouds = canvas(1, 1);
		key = "";
		build(W, H, m) {
			const night = m.stars > .5, u = H / 200, ch = Math.round(42 * u), cl = canvas(W * 2, ch), cg = cl.getContext("2d"), img = cg.createImageData(cl.width, ch), d = img.data;
			const light = night ? [
				74,
				82,
				136
			] : [
				255,
				255,
				255
			], shade = night ? [
				58,
				64,
				116
			] : m.skyBot;
			for (let y = 0; y < ch; y++) for (let x = 0; x < cl.width; x++) {
				const yy = y / u, xx = x / u, nv = noise(xx * .035, yy * .11, 8) * .7 + noise(xx * .09, yy * .25, 9) * .3 - Math.abs(yy - 14) / 30, o = (y * cl.width + x) * 4;
				if (nv <= .5) continue;
				const c = nv < .56 || yy > 17 ? shade : light;
				d[o] = c[0];
				d[o + 1] = c[1];
				d[o + 2] = c[2];
				d[o + 3] = 235;
			}
			cg.putImageData(img, 0, 0);
			this.clouds = cl;
		}
		/** Himmel bis zum Horizont yH; `pan` = Kameraversatz in Pixeln (Wolken und Hügel ziehen langsamer mit). */
		draw(g, W, H, yH, m, zeit, t, pan) {
			const key = `${W}x${H}|${zeit}`;
			if (key !== this.key) {
				this.build(W, H, m);
				this.key = key;
			}
			const u = H / 200, grad = g.createLinearGradient(0, 0, 0, yH);
			grad.addColorStop(0, css(m.skyTop));
			grad.addColorStop(1, css(m.skyBot));
			g.fillStyle = grad;
			g.fillRect(0, 0, W, yH + 2);
			if (m.stars > .05) {
				const R = rng(3);
				g.globalAlpha = m.stars;
				for (let i = 0; i < 70 * W / (320 * u); i++) {
					g.fillStyle = R() < .2 ? "#fff6c8" : "#dfe6ff";
					g.fillRect(Math.floor(R() * W), Math.floor(R() * yH * .8), Math.ceil(u), Math.ceil(u));
				}
				const mx = W * .78, my = H * .07, r = H * .03;
				g.fillStyle = "#fff4d6";
				g.beginPath();
				g.arc(mx, my, r, 0, 7);
				g.fill();
				g.fillStyle = css(m.skyTop);
				g.beginPath();
				g.arc(mx + r * .5, my - r * .33, r * .92, 0, 7);
				g.fill();
				g.globalAlpha = 1;
			}
			const cw = this.clouds.width, off = ((t * 3 * u + pan * .08) % cw + cw) % cw;
			g.drawImage(this.clouds, -off, Math.round(2 * u));
			g.drawImage(this.clouds, cw - off, Math.round(2 * u));
			const hc = m.haze, hc2 = m.skyBot, c1 = css([
				hc[0] * .78 + hc2[0] * .1,
				hc[1] * .86 + hc2[1] * .08,
				hc[2] * .95
			]), c2 = css([
				hc[0] * .62,
				hc[1] * .78,
				hc[2] * .8
			]);
			const step = Math.max(1, Math.round(u));
			for (let x = 0; x < W; x += step) {
				const xx = (x + pan * .25) / u;
				g.fillStyle = c1;
				g.fillRect(x, Math.round(yH - (9 + 7 * noise(xx * .025, 0, 3)) * u), step, Math.round(20 * u));
				g.fillStyle = c2;
				g.fillRect(x, Math.round(yH - (4 + 4 * noise(xx * .05, 1, 4)) * u), step, Math.round(20 * u));
			}
		}
	};
	var TEILE = (() => {
		const R = rng(21);
		return Array.from({ length: 26 }, () => ({
			x: R(),
			y: R(),
			p: R() * 6.28,
			sp: .3 + R() * .6,
			c: R()
		}));
	})();
	/** Teilchen wie in Mockup A: tags Schmetterlinge, abends Blütenblätter, nachts Glühwürmchen. Ein Block = ein Weltpixel (z). */
	function teilchen(g, W, H, yTop, m, zeit, t, panX, panY, z, dpr) {
		const top = yTop + 20 * dpr, span = H - top - 40 * dpr;
		if (span <= 0) return;
		for (let i = 0; i < TEILE.length; i++) {
			const a = TEILE[i], ax = a.x * W + Math.sin(t * a.sp + a.p) * 30 * dpr + t * 6 * dpr - panX, ay = a.y * span + Math.cos(t * a.sp * 1.3 + a.p) * 18 * dpr - panY;
			const x = Math.round((ax % W + W) % W / z) * z, y = top + Math.round((ay % span + span) % span / z) * z;
			if (m.stars > .5) {
				const f = .5 + .5 * Math.sin(t * 2 + a.p * 3);
				g.fillStyle = `rgba(214,255,140,${f})`;
				g.fillRect(x, y, z, z);
				g.fillStyle = `rgba(214,255,140,${f * .25})`;
				g.fillRect(x - z, y - z, 3 * z, 3 * z);
			} else if (zeit === "Abend") {
				g.fillStyle = a.c < .5 ? "#ffc2d6" : "#fff0f5";
				g.fillRect(x, y, z, z);
			} else if (i < 6) {
				const wh = Math.sin(t * 14 + a.p) > 0 ? z : Math.ceil(z / 2);
				g.fillStyle = a.c < .5 ? "#ffffff" : "#ffd94f";
				g.fillRect(x - z, y, z, wh);
				g.fillRect(x + z, y, z, wh);
				g.fillStyle = WP.outline;
				g.fillRect(x, y, z, z);
			}
		}
	}
	function vignette(g, W, H, m) {
		const vg = g.createRadialGradient(W / 2, H * .55, H * .45, W / 2, H * .55, H * .95);
		vg.addColorStop(0, "rgba(30,20,40,0)");
		vg.addColorStop(1, m.stars > .5 ? "rgba(5,8,25,0.55)" : "rgba(40,25,40,0.28)");
		g.fillStyle = vg;
		g.fillRect(0, 0, W, H);
	}
	/** Tilt-Shift als Unschärfe-Ebene über dem Bild (wie in der App): scharf in der Mitte, weich zum Rand. */
	function tiltMask(el, mode) {
		el.style.display = mode === "aus" ? "none" : "";
		const m = mode === "tiefe" ? "linear-gradient(to bottom, #000 0%, rgba(0,0,0,.85) 14%, rgba(0,0,0,.35) 32%, transparent 48%, transparent 86%, rgba(0,0,0,.6) 100%)" : "linear-gradient(to bottom, #000 0%, rgba(0,0,0,.85) 12%, transparent 30%, transparent 84%, rgba(0,0,0,.75) 100%)";
		el.style.maskImage = m;
		el.style.setProperty("-webkit-mask-image", m);
	}
	//#endregion
	//#region ../docs/mockups/welt-optik/ruhig/figuren.ts
	var SPEED = 42;
	var R = rng(7);
	var footOf = (s) => ({
		x: s.tx * 16 + 8,
		y: s.ty * 16 + 12
	});
	var tileOf = (f) => ({
		tx: Math.floor(f.x / 16),
		ty: Math.floor(f.y / 16),
		inside: f.inside
	});
	function makeFig(id, name, tx, ty, inside, idle) {
		return {
			id,
			name,
			...footOf({
				tx,
				ty,
				inside
			}),
			inside,
			dir: "down",
			walked: 0,
			path: [],
			idle,
			goal: null
		};
	}
	/** Ziel setzen; false, wenn es keinen Weg gibt. */
	function sendTo(f, tx, ty, inside, byPlayer) {
		const p = route(tileOf(f), tx, ty, inside);
		if (!p) return false;
		f.path = p;
		f.goal = {
			tx,
			ty,
			inside
		};
		if (byPlayer) f.idle = 25;
		return true;
	}
	function stepFig(f, dt) {
		if (!f.path.length) {
			f.goal = null;
			f.idle -= dt;
			if (f.idle <= 0) {
				const to = nearby(tileOf(f), 6, R);
				if (to) sendTo(f, to.tx, to.ty, to.inside, false);
				f.idle = 5 + R() * 9;
			}
			return;
		}
		let left = SPEED * dt;
		while (left > 0 && f.path.length) {
			const s = f.path[0], t = footOf(s), dx = t.x - f.x, dy = t.y - f.y, d = Math.hypot(dx, dy);
			if (d > .01) f.dir = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? "left" : "right" : dy < 0 ? "up" : "down";
			if (d <= left) {
				f.x = t.x;
				f.y = t.y;
				f.inside = s.inside;
				f.path.shift();
				left -= d;
				f.walked += d;
			} else {
				f.x += dx / d * left;
				f.y += dy / d * left;
				f.walked += left;
				left = 0;
			}
		}
	}
	var frameOf = (f) => f.path.length ? Math.floor(f.walked / 5) % 4 : "stand";
	var doing = (f) => f.path.length ? f.idle > 10 ? "geht" : "schlendert" : "steht";
	//#endregion
	//#region ../docs/mockups/welt-optik/ruhig/kamera.ts
	var Kamera = class {
		W;
		H;
		zMin;
		zMax;
		bounds;
		x = 0;
		y = 0;
		z = 4;
		zt = 4;
		anchor = null;
		goal = null;
		stepWait = 0;
		wheel = 0;
		constructor(W, H, zMin, zMax, bounds) {
			this.W = W;
			this.H = H;
			this.zMin = zMin;
			this.zMax = zMax;
			this.bounds = bounds;
		}
		/** Ganzzahliger Versatz der Welt im Bild (Gerätepixel): für Boden, Dinge und Figuren derselbe. */
		offset() {
			return {
				ox: Math.round(this.W / 2 - this.x * this.z),
				oy: Math.round(this.H / 2 - this.y * this.z)
			};
		}
		toWorld(sx, sy) {
			const { ox, oy } = this.offset();
			return {
				x: (sx - ox) / this.z,
				y: (sy - oy) / this.z
			};
		}
		/** Größter Zoom, bei dem `r` ganz ins Bild passt (mindestens zMin). */
		fitZoom(r, share = 1) {
			return Math.max(this.zMin, Math.min(this.zMax, Math.floor(Math.min(this.W * share / (r.x1 - r.x0), this.H * share / (r.y1 - r.y0)))));
		}
		/** Mausrad: gesammelt, eine Stufe je Raste, Anker unter dem Mauszeiger. */
		wheelBy(dy, ax, ay) {
			this.wheel += dy;
			while (Math.abs(this.wheel) >= 40) {
				const s = this.wheel > 0 ? -1 : 1;
				this.wheel -= -s * 40;
				this.zoomTo(this.zt + s, ax, ay);
			}
		}
		zoomTo(z, ax = this.W / 2, ay = this.H / 2) {
			this.zt = Math.max(this.zMin, Math.min(this.zMax, z));
			this.anchor = [ax, ay];
		}
		/** Sanft zu einem Punkt gleiten (Taste 0, Haus betreten). */
		glideTo(x, y, z) {
			this.goal = [x, y];
			if (z !== void 0) this.zoomTo(z);
			this.anchor = null;
		}
		dragBy(dx, dy) {
			this.x -= dx / this.z;
			this.y -= dy / this.z;
			this.goal = null;
			this.clamp();
		}
		/** Je Bild: Tasten (WASD, Pfeile), Gleiten, Zoomstufen. `dt` in Sekunden. */
		update(dt, keys, unproj = (sx, sy) => this.toWorldF(sx, sy)) {
			const k = (a, b) => keys.has(a) || keys.has(b) ? 1 : 0;
			const kx = k("KeyD", "ArrowRight") - k("KeyA", "ArrowLeft"), ky = k("KeyS", "ArrowDown") - k("KeyW", "ArrowUp");
			if (kx || ky) {
				const fast = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 2 : 1, n = Math.hypot(kx, ky), sp = fast * 520 * (this.W / 1400 + .4) / this.z;
				this.x += kx / n * sp * dt;
				this.y += ky / n * sp * dt;
				this.goal = null;
			}
			if (this.goal) {
				const a = Math.min(1, dt * 7);
				this.x += (this.goal[0] - this.x) * a;
				this.y += (this.goal[1] - this.y) * a;
				if (Math.hypot(this.goal[0] - this.x, this.goal[1] - this.y) < .3) {
					[this.x, this.y] = this.goal;
					this.goal = null;
				}
			}
			this.stepWait -= dt;
			if (this.z !== this.zt && this.stepWait <= 0) {
				const [ax, ay] = this.anchor ?? [this.W / 2, this.H / 2], w0 = unproj(ax, ay) ?? this.toWorldF(ax, ay);
				this.z += Math.sign(this.zt - this.z);
				if (this.anchor) {
					const w1 = unproj(ax, ay) ?? this.toWorldF(ax, ay);
					this.x += w0.x - w1.x;
					this.y += w0.y - w1.y;
				}
				this.stepWait = .035;
			}
			this.clamp();
		}
		toWorldF(sx, sy) {
			return {
				x: this.x + (sx - this.W / 2) / this.z,
				y: this.y + (sy - this.H / 2) / this.z
			};
		}
		clamp() {
			const b = this.bounds, hw = this.W / 2 / this.z, hh = this.H / 2 / this.z;
			this.x = b.x1 - b.x0 <= 2 * hw ? (b.x0 + b.x1) / 2 : Math.max(b.x0 + hw, Math.min(b.x1 - hw, this.x));
			this.y = b.y1 - b.y0 <= 2 * hh ? (b.y0 + b.y1) / 2 : Math.max(b.y0 + hh, Math.min(b.y1 - hh, this.y));
		}
	};
	//#endregion
	//#region ../docs/mockups/welt-optik/ruhig/tiefe.ts
	var A = 29;
	var HOR = .13;
	var DROOP = .035;
	var Tiefe = class {
		ground;
		yF = 0;
		yH = 0;
		dW = /* @__PURE__ */ new Float64Array(0);
		sc = /* @__PURE__ */ new Float64Array(0);
		drop = /* @__PURE__ */ new Int16Array(0);
		key = "";
		levels = [];
		tmp = canvas(1, 1);
		constructor(ground) {
			this.ground = ground;
			let src = ground;
			this.levels = [ground];
			for (let i = 0; i < 3; i++) {
				const c = canvas(Math.ceil(src.width / 2), Math.ceil(src.height / 2)), g = c.getContext("2d");
				g.imageSmoothingEnabled = true;
				g.imageSmoothingQuality = "high";
				g.drawImage(src, 0, 0, c.width, c.height);
				this.levels.push(c);
				src = c;
			}
		}
		setup(W, H, z) {
			const key = `${W}x${H}x${z}`;
			if (key === this.key) return;
			this.key = key;
			this.yF = Math.round(H / 2);
			this.yH = Math.round(H * HOR);
			this.dW = new Float64Array(this.yF + 1);
			this.sc = new Float64Array(this.yF + 1);
			this.sc[this.yF] = 1;
			for (let y = this.yF - 1; y >= 0; y--) {
				const d = (this.yF - y - .5) / H, s = 1 / (1 + A * d * d);
				this.sc[y] = s;
				this.dW[y] = this.dW[y + 1] - 1 / (z * s);
			}
			this.drop = new Int16Array(W);
			for (let x = 0; x < W; x++) {
				const u = (x + .5 - W / 2) / (W / 2);
				this.drop[x] = Math.round(DROOP * H * u * u);
			}
			this.tmp.width = W;
			this.tmp.height = H;
		}
		droop = (x) => this.drop[Math.max(0, Math.min(this.drop.length - 1, Math.round(x)))] ?? 0;
		/** Welt → Bild (ohne seitliches Absinken). ox/oy wie in der ebenen Ansicht, z ganzzahlig. */
		project(wx, wy, ox, oy, z, W) {
			const sy = oy + wy * z;
			if (sy >= this.yF) return {
				x: ox + wx * z,
				y: sy,
				s: 1
			};
			const d = wy - (this.yF - oy) / z;
			if (d < this.dW[this.yH]) return null;
			let lo = this.yH, hi = this.yF;
			while (hi - lo > 1) {
				const m = lo + hi >> 1;
				if (this.dW[m] <= d) lo = m;
				else hi = m;
			}
			const f = (d - this.dW[lo]) / (this.dW[lo + 1] - this.dW[lo]), s = this.sc[lo], cx = (W / 2 - ox) / z;
			return {
				x: W / 2 + (wx - cx) * z * s,
				y: lo + f,
				s
			};
		}
		/** Bild → Welt (mit seitlichem Absinken); im Himmel null. */
		unproject(sx, sy, ox, oy, z, W) {
			const y = sy - this.droop(sx);
			if (y >= this.yF) return {
				x: (sx - ox) / z,
				y: (y - oy) / z
			};
			if (y < this.yH) return null;
			const r = Math.floor(y), f = y - r, s = this.sc[r];
			return {
				x: (W / 2 - ox) / z + (sx - W / 2) / (z * s),
				y: (this.yF - oy) / z + this.dW[r] + f * (this.dW[r + 1] - this.dW[r])
			};
		}
		/** Ferner Boden: je Zeile ein gefilterter Streifen aus der passenden Stufe, darüber Dunst. */
		drawFar(g, ox, oy, z, W, haze) {
			const cx = (W / 2 - ox) / z, wyF = (this.yF - oy) / z, far = this.dW[this.yH];
			g.imageSmoothingEnabled = true;
			g.imageSmoothingQuality = "low";
			for (let y = this.yH; y < this.yF; y++) {
				const k = z * this.sc[y], L = k >= 1 ? 0 : k >= .5 ? 1 : k >= .25 ? 2 : 3, img = this.levels[L], f = 1 / (1 << L);
				const w0 = cx - W / 2 / k, sy = (wyF + this.dW[y] + 320) * f, sh = (this.dW[y + 1] - this.dW[y]) * f;
				let sx = (w0 + 320) * f, sw = W / k * f, dx = 0, dw = W;
				if (sx < 0) {
					const cut = -sx;
					dx += cut / sw * W;
					dw -= cut / sw * W;
					sw -= cut;
					sx = 0;
				}
				const maxW = GW * f - sx;
				if (sw > maxW) {
					dw *= maxW / sw;
					sw = maxW;
				}
				if (sw > 0 && dw > 0 && sy >= 0 && sy + sh <= GH * f) g.drawImage(img, sx, sy, sw, sh, dx, y, dw, 1);
				const t = this.dW[y] / far, fog = Math.pow(t, 2.2) * .55;
				if (fog > .01) {
					g.fillStyle = `rgba(${haze[0] | 0},${haze[1] | 0},${haze[2] | 0},${fog})`;
					g.fillRect(0, y, W, 1);
				}
			}
			g.imageSmoothingEnabled = false;
		}
		/** Seitliches Absinken: das fertige Bild spaltenweise um ganze Pixel nach unten schieben; oben scheint der Himmel nach. */
		bend(g, W, H, skyTop) {
			const t = this.tmp.getContext("2d");
			t.clearRect(0, 0, W, H);
			t.drawImage(g.canvas, 0, 0);
			g.fillStyle = skyTop;
			g.fillRect(0, 0, W, H);
			for (let x = 0; x < W;) {
				const d = this.drop[x];
				let e = x + 1;
				while (e < W && this.drop[e] === d) e++;
				g.drawImage(this.tmp, x, 0, e - x, H - d, x, d, e - x, H - d);
				x = e;
			}
		}
	};
	//#endregion
	//#region ../docs/mockups/welt-optik/ruhig/main.ts
	var dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
	var cv = document.getElementById("welt");
	var g = cv.getContext("2d");
	var tiltEl = document.getElementById("tilt");
	var sc = document.getElementById("schilder");
	var lg = sc.getContext("2d");
	var OUT = {
		x0: -96,
		y0: -96,
		x1: 1120,
		y1: 736
	};
	var HOUSE = {
		x0: BLD.x0 * 16 - 40,
		y0: BLD.y0 * 16 - 56,
		x1: BLD.x1 * 16 + 40,
		y1: BLD.y1 * 16 + 40
	};
	var items = outdoorItems();
	var indoor = indoorItems();
	var wallList = walls();
	var ground = groundTexture(items.filter((i) => i.shadow).map((i) => ({
		x: i.x,
		y: i.y,
		w: i.spr(false).width
	})));
	var floor = floorTexture();
	var tiefe = new Tiefe(ground);
	var himmel = new Himmel();
	var figs = [makeFig("alex", "Alex", 33, 9, false, 4), makeFig("mira", "Mira", 14, 7, true, 9)];
	var shadowSpr = (() => {
		const c = canvas(11, 4), s = c.getContext("2d");
		s.fillStyle = "rgba(40,30,60,0.3)";
		s.beginPath();
		s.ellipse(5.5, 2, 5.5, 2, 0, 0, 7);
		s.fill();
		return c;
	})();
	var zeit = "Mittag";
	var interior = false;
	var selected = "alex";
	var saved = null;
	var ansicht = "tiefe";
	var effekte = true;
	var mark = null;
	var hoverAt = null;
	var keys = /* @__PURE__ */ new Set();
	var cam = new Kamera(1, 1, dpr, dpr * 7, OUT);
	var deep = () => ansicht === "tiefe" && !interior;
	function resize() {
		cv.width = Math.round(innerWidth * dpr);
		cv.height = Math.round(innerHeight * dpr);
		cv.style.width = `${innerWidth}px`;
		cv.style.height = `${innerHeight}px`;
		sc.width = cv.width;
		sc.height = cv.height;
		sc.style.width = cv.style.width;
		sc.style.height = cv.style.height;
		cam.W = cv.width;
		cam.H = cv.height;
		cam.zMin = Math.max(1, Math.min(dpr, cam.fitZoom(OUT)));
		cam.clamp();
	}
	/** Welt → Bild vor dem seitlichen Absinken (zum Zeichnen). */
	function place(wx, wy) {
		const z = cam.z, { ox, oy } = cam.offset();
		if (!deep()) return {
			x: ox + wx * z,
			y: oy + wy * z,
			s: 1
		};
		tiefe.setup(cv.width, cv.height, z);
		return tiefe.project(wx, wy, ox, oy, z, cv.width);
	}
	/** Welt → Bild, fertig (für Schilder, Marken). */
	function screen(wx, wy) {
		const p = place(wx, wy);
		return p && {
			x: p.x,
			y: p.y + (deep() ? tiefe.droop(p.x) : 0),
			s: p.s
		};
	}
	/** Bild → Welt (Klick, Zoom-Anker). */
	function worldAt(sx, sy) {
		if (!deep()) return cam.toWorld(sx, sy);
		const { ox, oy } = cam.offset();
		tiefe.setup(cv.width, cv.height, cam.z);
		return tiefe.unproject(sx, sy, ox, oy, cam.z, cv.width);
	}
	var picks = [];
	/** Sprite mit Fußpunkt (wx, wy). Im ebenen Teil ganzzahlig und pixelgenau, in der Ferne gleichmäßig verkleinert und gefiltert. */
	function blit(spr, wx, wy, round = true) {
		const ox = cam.offset().ox, oy = cam.offset().oy, z = cam.z;
		if (!deep() || oy + wy * z >= tiefe.yF) {
			const lx = round ? Math.round(wx - spr.width / 2) : wx - spr.width / 2, ty = round ? Math.round(wy - spr.height) : wy - spr.height;
			const x = Math.round(ox + lx * z), y = Math.round(oy + ty * z);
			if (x > cv.width || y > cv.height || x + spr.width * z < 0) return null;
			g.drawImage(spr, x, y, spr.width * z, spr.height * z);
			return [
				x,
				y,
				z
			];
		}
		const p = place(wx, wy);
		if (!p) return null;
		const k = z * p.s, x = p.x - spr.width / 2 * k, y = p.y - spr.height * k;
		if (x > cv.width || x + spr.width * k < 0) return null;
		g.imageSmoothingEnabled = true;
		g.drawImage(spr, x, y, spr.width * k, spr.height * k);
		g.imageSmoothingEnabled = false;
		return [
			x,
			y,
			k
		];
	}
	function pick(kind, id, spr, r) {
		if (!r) return;
		const [x, y, k] = r, w = spr.width * k;
		picks.push({
			kind,
			id,
			x,
			y: y + (deep() ? tiefe.droop(x + w / 2) : 0),
			w,
			h: spr.height * k,
			spr
		});
	}
	function drawFig(f) {
		blit(shadowSpr, f.x + 1, f.y + 2, false);
		const p = place(f.x, f.y + .5);
		if (f.id === selected && p) {
			const k = cam.z * p.s;
			g.strokeStyle = accentOf(f.id);
			g.lineWidth = Math.max(2, k * .75);
			g.beginPath();
			g.ellipse(Math.round(p.x), Math.round(p.y), 7 * k, 2.6 * k, 0, 0, 7);
			g.stroke();
		}
		const spr = figure(f.id, f.dir, frameOf(f));
		pick("fig", f.id, spr, blit(spr, f.x, f.y, false));
	}
	function tag(text, accent, cx, y, up, strong = false) {
		lg.font = `600 ${11 * dpr}px ui-rounded, system-ui, sans-serif`;
		const w = lg.measureText(text).width + 12 * dpr, h = 16 * dpr, x = Math.round(cx - w / 2), top = Math.round(up ? y - h : y);
		lg.fillStyle = strong ? "rgba(43,34,51,0.95)" : "rgba(43,34,51,0.78)";
		lg.strokeStyle = accent;
		lg.lineWidth = dpr;
		lg.beginPath();
		lg.roundRect(x, top, w, h, 5 * dpr);
		lg.fill();
		lg.stroke();
		lg.fillStyle = "#fff8ec";
		lg.textBaseline = "middle";
		lg.fillText(text, x + 6 * dpr, top + h / 2 + .5);
	}
	function lights(m) {
		if (m.glowA <= 0) return;
		const L = [];
		if (!interior) {
			for (const [dx, h, s] of HOUSE_LIGHTS) L.push([
				DOOR.x + dx,
				DOOR.y,
				h,
				s
			]);
			for (const it of items) for (const [h, s] of it.light ?? []) if (it.kind === "lamp") L.push([
				it.x,
				it.y,
				h,
				s
			]);
		} else for (const it of indoor) for (const [h, s] of it.light ?? []) L.push([
			it.x,
			it.y,
			h,
			s
		]);
		g.globalCompositeOperation = "lighter";
		for (const [x, y, h, s] of L) {
			const p = place(x, y);
			if (!p) continue;
			const k = cam.z * p.s, gx = p.x, gy = p.y - h * k, r = 16 * k * s, rg = g.createRadialGradient(gx, gy, 0, gx, gy, r);
			rg.addColorStop(0, `rgba(255,205,120,${m.glowA})`);
			rg.addColorStop(.35, `rgba(255,170,90,${m.glowA * .4})`);
			rg.addColorStop(1, "rgba(255,150,80,0)");
			g.fillStyle = rg;
			g.fillRect(gx - r, gy - r, r * 2, r * 2);
		}
		g.globalCompositeOperation = "source-over";
	}
	function drawGround(m, t) {
		const z = cam.z, { ox, oy } = cam.offset(), W = cv.width, H = cv.height, top = deep() ? tiefe.yF : 0;
		g.fillStyle = "#437c40";
		g.fillRect(0, 0, W, H);
		if (deep()) {
			himmel.draw(g, W, H, tiefe.yH, m, zeit, t, -ox);
			tiefe.drawFar(g, ox, oy, z, W, m.haze);
		}
		const sx = Math.max(0, Math.floor(-ox / z + 320)), sy = Math.max(0, Math.floor((top - oy) / z + 320) - 1);
		const sw = Math.min(GW - sx, Math.ceil(W / z) + 2), sh = Math.min(GH - sy, Math.ceil((H - top) / z) + 2);
		if (sw <= 0 || sh <= 0) return;
		g.save();
		g.beginPath();
		g.rect(0, top, W, H - top);
		g.clip();
		g.drawImage(ground, sx, sy, sw, sh, ox + (sx - 320) * z, oy + (sy - 320) * z, sw * z, sh * z);
		g.restore();
	}
	function render(t) {
		const m = TIMES[zeit], lit = m.lights > .5, z = cam.z, { ox, oy } = cam.offset(), W = cv.width, H = cv.height;
		picks = [];
		lg.clearRect(0, 0, W, H);
		g.imageSmoothingEnabled = false;
		if (deep()) tiefe.setup(W, H, z);
		drawGround(m, t);
		const inHouse = figs.filter((f) => f.inside), vy0 = deep() ? -Infinity : -oy / z - 16, vy1 = (H - oy) / z + 64;
		const list = [...items.filter((i) => i.y > vy0 && i.y < vy1), ...figs.filter((f) => !f.inside)];
		list.sort((a, b) => a.y - b.y);
		for (const it of list) {
			if ("name" in it) {
				drawFig(it);
				continue;
			}
			const spr = it.spr(lit || it.kind === "house" && inHouse.length > 0), r = blit(spr, it.x, it.y);
			if (it.kind === "house") pick("house", "house", spr, r);
		}
		if (interior) {
			const bx = ox + BLD.x0 * 16 * z, by = oy + BLD.y0 * 16 * z, bw = (BLD.x1 - BLD.x0) * 16 * z, bh = (BLD.y1 - BLD.y0) * 16 * z;
			g.fillStyle = "rgba(24,16,34,0.62)";
			g.beginPath();
			g.rect(0, 0, W, H);
			g.rect(bx, by - 22 * z, bw, bh + 22 * z);
			g.fill("evenodd");
			g.drawImage(floor, bx, by, bw, bh);
			[
				...wallList.map((w) => ({
					y: w.y,
					draw: () => drawWall(g, w, z, ox, oy)
				})),
				...indoor.map((it) => ({
					y: it.y,
					draw: () => {
						blit(it.spr(lit), it.x, it.y);
					}
				})),
				...inHouse.map((f) => ({
					y: f.y,
					draw: () => drawFig(f)
				}))
			].sort((a, b) => a.y - b.y).forEach((p) => p.draw());
		}
		const grade = interior ? m.grade.map((c, i) => c + ([
			255,
			236,
			210
		][i] - c) * .55 * m.lights) : m.grade;
		if (grade.some((c) => c < 255)) {
			g.globalCompositeOperation = "multiply";
			g.fillStyle = css(grade);
			g.fillRect(0, 0, W, H);
			g.globalCompositeOperation = "source-over";
		}
		lights(m);
		if (deep()) tiefe.bend(g, W, H, css(m.skyTop));
		if (effekte) {
			if (!interior) teilchen(g, W, H, deep() ? tiefe.yH : 0, m, zeit, t, -ox, -oy, z, dpr);
			vignette(g, W, H, m);
		}
		if (mark) {
			const a = Math.max(0, 1 - (performance.now() - mark.t) / 1600), p = screen(mark.x, mark.y);
			if (p) {
				const k = z * p.s;
				g.strokeStyle = `rgba(255,248,236,${a})`;
				g.lineWidth = Math.max(2, k * .6);
				g.beginPath();
				g.ellipse(p.x, p.y, 6 * k, 2.5 * k, 0, 0, 7);
				g.stroke();
			}
			if (a <= 0) mark = null;
		}
		for (const f of figs) {
			if (f.inside !== interior) continue;
			const p = screen(f.x, f.y + 3);
			if (p) tag(`${f.name} · ${doing(f)}`, accentOf(f.id), p.x, p.y, false, f.id === selected);
		}
		const roof = screen(DOOR.x, DOOR.y);
		if (!interior && roof) inHouse.forEach((f, i) => tag(`${f.name} · im Haus`, accentOf(f.id), roof.x, roof.y - 82 * z * roof.s - i * 20 * dpr, true, f.id === selected));
		if (interior) for (const r of ROOMS) tag(r.name, "#fff8ec", ox + (r.r[0] + r.r[2] / 2) * 16 * z, oy + (r.r[1] + .3) * 16 * z, true);
		if (hoverAt && !interior && hit(hoverAt[0], hoverAt[1])?.kind === "house") tag(inHouse.length ? `Haus · ${inHouse.map((f) => f.name).join(", ")} drin – Klick: hineinsehen` : "Haus · leer – Klick: hineinsehen", "#fff8ec", hoverAt[0], hoverAt[1] - 14 * dpr, true, true);
	}
	var alphaOf = /* @__PURE__ */ new WeakMap();
	function hit(sx, sy) {
		for (let i = picks.length - 1; i >= 0; i--) {
			const p = picks[i];
			if (sx < p.x || sy < p.y || sx >= p.x + p.w || sy >= p.y + p.h) continue;
			let a = alphaOf.get(p.spr);
			if (!a) {
				a = p.spr.getContext("2d").getImageData(0, 0, p.spr.width, p.spr.height).data;
				alphaOf.set(p.spr, a);
			}
			const px = Math.floor((sx - p.x) / p.w * p.spr.width), py = Math.floor((sy - p.y) / p.h * p.spr.height);
			if (a[(py * p.spr.width + px) * 4 + 3] > 40) return p;
		}
		return null;
	}
	function enter() {
		if (interior) return;
		saved = {
			x: cam.x,
			y: cam.y,
			z: cam.zt
		};
		interior = true;
		cam.bounds = HOUSE;
		cam.glideTo((HOUSE.x0 + HOUSE.x1) / 2, (HOUSE.y0 + HOUSE.y1) / 2, cam.fitZoom(HOUSE, .96));
		ui();
	}
	function leave() {
		if (!interior) return;
		interior = false;
		cam.bounds = OUT;
		if (saved) cam.glideTo(saved.x, saved.y, saved.z);
		ui();
	}
	function click(sx, sy) {
		const p = hit(sx, sy);
		if (p?.kind === "fig") {
			selected = p.id;
			return;
		}
		if (p?.kind === "house") {
			enter();
			return;
		}
		const w = worldAt(sx, sy);
		if (!w) return;
		const tx = Math.floor(w.x / 16), ty = Math.floor(w.y / 16), f = figs.find((x) => x.id === selected);
		if (interior && !inBld(tx, ty)) {
			leave();
			return;
		}
		for (const [dx, dy] of [
			[0, 0],
			[0, 1],
			[1, 0],
			[-1, 0],
			[0, -1]
		]) {
			if (!walkable(tx + dx, ty + dy, interior)) continue;
			if (sendTo(f, tx + dx, ty + dy, interior, true)) {
				mark = {
					x: (tx + dx) * 16 + 8,
					y: (ty + dy) * 16 + 12,
					t: performance.now()
				};
				return;
			}
		}
	}
	var down = null;
	cv.addEventListener("pointerdown", (e) => {
		down = {
			x: e.clientX,
			y: e.clientY,
			moved: false
		};
		cv.setPointerCapture(e.pointerId);
	});
	cv.addEventListener("pointermove", (e) => {
		hoverAt = [e.clientX * dpr, e.clientY * dpr];
		cv.style.cursor = hit(hoverAt[0], hoverAt[1]) ? "pointer" : down?.moved ? "grabbing" : "default";
		if (!down) return;
		const dx = e.clientX - down.x, dy = e.clientY - down.y;
		if (!down.moved && Math.hypot(dx, dy) < 5) return;
		down.moved = true;
		cam.dragBy(dx * dpr, dy * dpr);
		down.x = e.clientX;
		down.y = e.clientY;
	});
	cv.addEventListener("pointerup", (e) => {
		if (down && !down.moved) click(e.clientX * dpr, e.clientY * dpr);
		down = null;
	});
	cv.addEventListener("pointerleave", () => {
		hoverAt = null;
	});
	cv.addEventListener("wheel", (e) => {
		e.preventDefault();
		cam.wheelBy(e.deltaY * (e.deltaMode === 1 ? 30 : 1), e.clientX * dpr, e.clientY * dpr);
	}, { passive: false });
	addEventListener("keydown", (e) => {
		if (e.target.tagName === "BUTTON" && (e.code === "Space" || e.code === "Enter")) return;
		keys.add(e.code);
		if (e.code.startsWith("Arrow")) e.preventDefault();
		if (e.code === "Escape") leave();
		if (e.code === "Digit0" || e.code === "Numpad0") {
			if (interior) leave();
			else cam.glideTo(512, 320, cam.fitZoom(OUT));
		}
		if (e.code === "Equal" || e.code === "BracketRight" || e.code === "NumpadAdd") cam.zoomTo(cam.zt + 1);
		if (e.code === "Minus" || e.code === "Slash" || e.code === "NumpadSubtract") cam.zoomTo(cam.zt - 1);
		if (e.code === "Tab") {
			e.preventDefault();
			selected = selected === "alex" ? "mira" : "alex";
		}
	});
	addEventListener("keyup", (e) => keys.delete(e.code));
	addEventListener("blur", () => keys.clear());
	addEventListener("resize", resize);
	var zoomEl = document.getElementById("zoom");
	var leaveEl = document.getElementById("raus");
	document.querySelectorAll("[data-zeit]").forEach((b) => b.addEventListener("click", () => {
		zeit = b.dataset.zeit;
		ui();
		b.blur();
	}));
	document.querySelectorAll("[data-ansicht]").forEach((b) => b.addEventListener("click", () => {
		ansicht = b.dataset.ansicht;
		ui();
		b.blur();
	}));
	var fxEl = document.getElementById("effekte");
	fxEl.addEventListener("click", () => {
		effekte = !effekte;
		ui();
		fxEl.blur();
	});
	leaveEl.addEventListener("click", () => {
		leave();
		leaveEl.blur();
	});
	function ui() {
		document.querySelectorAll("[data-zeit]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zeit === zeit)));
		document.querySelectorAll("[data-ansicht]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ansicht === ansicht)));
		fxEl.setAttribute("aria-pressed", String(effekte));
		tiltMask(tiltEl, !effekte || interior ? "aus" : deep() ? "tiefe" : "eben");
		leaveEl.hidden = !interior;
		document.body.dataset.innen = interior ? "1" : "";
	}
	var last = performance.now();
	function frame(now) {
		const dt = Math.min(.05, (now - last) / 1e3);
		last = now;
		cam.update(dt, keys, worldAt);
		for (const f of figs) stepFig(f, dt);
		render(now / 1e3);
		zoomEl.textContent = `Zoom ${cam.z / dpr}× · ${interior ? "im Haus" : "Dorf"}`;
		requestAnimationFrame(frame);
	}
	resize();
	cam.x = 480;
	cam.y = 256;
	cam.z = cam.zt = Math.min(cam.zMax, dpr * 3);
	cam.clamp();
	ui();
	requestAnimationFrame(frame);
	document.body.dataset.ready = "1";
	window.__ruhig = {
		cam,
		figs,
		enter,
		leave,
		setZeit: (z) => {
			zeit = z;
			ui();
		},
		select: (id) => {
			selected = id;
		},
		setAnsicht: (a) => {
			ansicht = a;
			ui();
		},
		setEffekte: (on) => {
			effekte = on;
			ui();
		}
	};
	//#endregion
})();
