import type React from "react";

type AFrameElementProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  [key: string]: unknown;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "a-scene": AFrameElementProps;
      "a-assets": AFrameElementProps;
      "a-sky": AFrameElementProps;
      "a-entity": AFrameElementProps;
      "a-camera": AFrameElementProps;
      "a-cursor": AFrameElementProps;
      "a-plane": AFrameElementProps;
      "a-text": AFrameElementProps;
    }
  }
}

export {};
