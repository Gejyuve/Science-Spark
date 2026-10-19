// Сайтын бараан газрын зургийн загвар (OpenFreeMap): ClubMap ба MiniMap хоёулаа ашиглана
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

export function siteColors(m) {
  const set = (id, k, v) => m.getLayer(id) && m.setPaintProperty(id, k, v);
  set("background", "background-color", "#071a1f");
  set("water", "fill-color", "#0b2b31");
  set("boundary_state", "line-color", "rgba(91,240,220,0.22)");
  for (const id of ["boundary_country_z0-4", "boundary_country_z5-"]) set(id, "line-color", "rgba(127,184,181,0.35)");
}
