// Ковер зураг оруулаагүй хэрэглэгчид шинжлэх ухааны сэдэвт 8 зургаас нэгийг (id-гаар нь тогтмол) харуулна
export const DEFAULT_COVERS = 8;

export const defaultCover = (id) => `/covers/${(Math.abs(Number(id) || 0) % DEFAULT_COVERS) + 1}.svg`;

// Профайл зураг оруулаагүй хэрэглэгчид шинжлэх ухааны сэдэвт 15 зургаас нэгийг (id-гаар нь тогтмол) харуулна
export const DEFAULT_AVATARS = 15;

export const defaultAvatar = (id) => `/avatars/${(Math.abs(Number(id) || 0) % DEFAULT_AVATARS) + 1}.svg`;
