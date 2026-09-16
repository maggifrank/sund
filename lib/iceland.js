/* Where a latitude and longitude land on the map page.
 *
 * The country is drawn on its own national grid — ISN93 / Lambert 1993, the
 * projection EPSG:3057 defines and every Icelandic map is printed in: a Lambert
 * conformal conic on GRS80 with standard parallels at 64°15' and 65°45' and its
 * origin at 65°N 19°W. Conformal means shape is preserved locally, so the
 * Westfjords look like the Westfjords; a plain lat/lon plot would stretch the
 * island sideways by a factor of two and a bit at these latitudes, and the
 * north would be visibly wider than the south.
 *
 * The false easting and northing EPSG:3057 carries are dropped — they exist to
 * keep national grid references positive, and nothing here is a grid reference.
 * SCALE, OX and OY take their place: metres to SVG units, and where the
 * projection's origin falls on the page. They are chosen so the coastline fills
 * a 1000×700 viewBox with MARGIN to spare on every side, which is what keeps a
 * marker sitting on the coast from being clipped in half.
 *
 * bin/build-coastline.mjs projects the coastline through this same function, so
 * the outline and the markers on it cannot drift apart: change a constant here
 * and the generator refuses to write an outline that no longer fits.
 */

export const VIEW = { w: 1000, h: 700 };
export const MARGIN = 20;

export const SCALE = 0.001866;   // SVG units per metre — 1 unit ≈ 536 m
const OX = 497.76;          // where 19°W falls
const OY = 346.11;          // where 65°N falls

const A = 6378137;                      // GRS80 semi-major axis, metres
const F = 1 / 298.257222101;            // GRS80 flattening
const E = Math.sqrt(F * (2 - F));       // first eccentricity

const rad = (deg) => (deg * Math.PI) / 180;
const PHI1 = rad(64.25), PHI2 = rad(65.75), PHI0 = rad(65), LAMBDA0 = rad(-19);

const m = (phi) => Math.cos(phi) / Math.sqrt(1 - E * E * Math.sin(phi) ** 2);
const t = (phi) => Math.tan(Math.PI / 4 - phi / 2) /
  (((1 - E * Math.sin(phi)) / (1 + E * Math.sin(phi))) ** (E / 2));

const N = (Math.log(m(PHI1)) - Math.log(m(PHI2))) / (Math.log(t(PHI1)) - Math.log(t(PHI2)));
const FACTOR = m(PHI1) / (N * t(PHI1) ** N);
const RHO0 = A * FACTOR * t(PHI0) ** N;

/* Lambert conformal conic, two standard parallels, straight out of the EPSG
   guidance note. Returns SVG coordinates: x east, y *down*, which is the one
   place this differs from the published formulas. */
export function project(lat, lon) {
  const rho = A * FACTOR * t(rad(lat)) ** N;
  const theta = N * (rad(lon) - LAMBDA0);
  return {
    x: OX + rho * Math.sin(theta) * SCALE,
    y: OY - (RHO0 - rho * Math.cos(theta)) * SCALE
  };
}

/* The capital area: a centre and a width in kilometres rather
   than a latitude/longitude box. The projection turns the graticule a couple of
   degrees at this longitude, so a box drawn from corners would come out very
   slightly askew, while a centre and a span cannot. 40 km takes in every pool
   from Álftanes to Mosfellsbær with room to spare, and Klébergslaug out on
   Kjalarnes with 3 km of it.

   It is where the map, zoomed in, stops drawing the country's coastline and
   draws a detailed one cut for this window alone. It lives here rather than
   beside the drawing code because that outline is cut at build time:
   bin/build-coastline.mjs clips and simplifies it through frame() below, and the
   page maps it back through the same frame(). Change the window and the
   generator has to run again. */
export const CAPITAL = { lat: 64.145, lon: -21.86, km: 40, aspect: 1.5 };

/* Where a window puts the map, in its own page units: how far the country's
   coordinates are blown up and where they slide to. The country map is the
   identity — z = 1 and no offset — so a null window needs no special case
   anywhere that uses this. */
export function frame(win) {
  if (!win) return { w: VIEW.w, h: VIEW.h, z: 1, tx: 0, ty: 0 };
  const w = VIEW.w, h = Math.round(VIEW.w / win.aspect);
  const z = w / (win.km * 1000 * SCALE);
  const centre = project(win.lat, win.lon);
  return { w, h, z, tx: w / 2 - centre.x * z, ty: h / 2 - centre.y * z };
}
