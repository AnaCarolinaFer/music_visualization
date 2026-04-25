/**
 * Splits images into connected components of pixel runs
 **/

//
// Creates a pixel classifier based on a brightness threshold
//
const blackWhite = (threshold = 128) => {
	let rgbaWord = new Uint32Array(1);
	let rgba = new Uint8Array(rgbaWord.buffer);
	return (pixel) => {
		rgbaWord[0] = pixel;
		return rgba[0] * 0.2126 + rgba[1] * 0.7152 + rgba[2] * 0.0722 >= threshold ? 1 : 0
	}
};

//
// Binary pixel classifier based on transparency
//
const opaque = (() => {
	let rgbaWord = new Uint32Array(1);
	let rgba = new Uint8Array(rgbaWord.buffer);
	return (pixel) => {
		rgbaWord[0] = pixel;
		return rgba[3] ? 0 : 1
	}
}) ();

// From an image data stored in array pixels with width w and
// height h, extract connected components using a pixel classifier.
// The result is an array of arrays of horizontal runs in the form
// {x, y, len}.
function imageComponents(pixels, w, h, pixelClassify = blackWhite()) {
	let data = new Uint32Array(pixels.buffer);

	// Divides vertical line of pixels at x into runs of identical pixel classe
	function getRuns(y) {
		let lastClass = -1;
		let run;
		let runs = [];
		for (let x = 0; x < w; x++) {
			const pixel = data[(w * y + x)];
			const pixelClass = pixelClassify(pixel);
			if (pixelClass !== lastClass) {
				run = {
					pixelClass,
					x,
					y,
					len: 1
				};
				runs.push(run)
				lastClass = pixelClass;
			} else {
				run.len++;
			}
		}
		return runs
	}

	//
	// Union find stuff
	//
	let components = []
	const addComponent = (run) => {
		// (Rank is stored as a negative parent)
		components.push({
			run,
			parent: -1
		});
		return components.length - 1
	}

	// Non-recursive find with path compression
	const findCompressNonRecursive = (i) => {
		const path = [];
		while (components[i].parent >= 0) {
			path.push(i);
			i = components[i].parent;
		}
		for (let j of path) components[j].parent = i;
		return i;
	}

	// Recursive find with path compression
	const findCompressRecursive = (i) => {
		if (components[i].parent >= 0) {
			const result = findCompressRecursive(components[i].parent);
			components[i].parent = result;
			return result;
		}
		return i;
	}

	// Find with no path compression
	const findSimple = (i) => {
		while (components[i].parent >= 0) {
			i = components[i].parent;
		}
		return i;
	}

	// There's little difference w.r.t. findSimple, but it works better than findCompressNonRecursive
	const find = findCompressRecursive;

	// Merges two components
	const union = (s, t) => {
		if (components[s].parent >= 0 || components[t].parent >= 0) throw "Not sets";
		if (components[s].parent < components[t].parent)[s, t] = [t, s];
		let srank = components[s].parent;
		components[s].parent = t;
		components[t].parent = min(components[t].parent, srank - 1);
		return t
	}

	// Current scanline is given by a range of indices of components
	let scanlineStart = 0,
		scanlineEnd = 0;

	// Process all horizontal lines
	for (let y = 0; y < h; y++) {
		let runs = getRuns(y);
		for (let run of runs) addComponent(run);
		let i = scanlineStart,
			j = scanlineEnd,
			k = components.length;
		while (i < scanlineEnd && j < k) {
			let irun = components[i].run;
			let jrun = components[j].run;
			const overlap = !(irun.x + irun.len <= jrun.x || jrun.x + jrun.len <= irun.x);
			if (overlap && irun.pixelClass === jrun.pixelClass) {
				let icomp = find(i);
				let jcomp = find(j);
				if (jcomp != icomp) {
					let u = union(icomp, jcomp);
				}
			}
			if (irun.x + irun.len >= jrun.x + jrun.len) j++;
			else i++;
		}
		scanlineStart = scanlineEnd;
		scanlineEnd = k;
	}

	let compMap = new Map();
	for (let i = 0; i < components.length; i++) {
		let j = find(i);
		if (compMap.has(j)) compMap.get(j).push(components[i].run);
		else compMap.set(j, [components[i].run])
	}

	return [...compMap.values()];
}

function paintComponent(pixels, w, h, component, kolor) {
	let data = new Uint32Array(pixels.buffer);
	for (let {
			x,
			y,
			len
		}
		of component) {
		let i = y * w + x;
		while (len-- > 0) {
			data[i++] = kolor
		}
	}
}