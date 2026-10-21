// Ковер зураг оруулаагүй хэрэглэгчид шинжлэх ухааны сэдэвт 8 зургаас нэгийг (id-гаар нь тогтмол) харуулна
export const DEFAULT_COVERS = 8;

export const defaultCover = (id) => `/covers/${(Math.abs(Number(id) || 0) % DEFAULT_COVERS) + 1}.svg`;
