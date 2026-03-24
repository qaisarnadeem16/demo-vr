export type PanoramaScene = {
  title: string;
  imageSrc: string;
  creditLabel: string;
  creditUrl: string;
};

export const PANORAMA_SCENE: PanoramaScene = {
  title: "User Panorama",
  imageSrc: "/examples/360/pana.jpg",
  creditLabel: "Local pano.jpg provided in project",
  creditUrl: "/examples/360-tour",
};
