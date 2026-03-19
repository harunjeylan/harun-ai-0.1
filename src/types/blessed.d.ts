import "@types/blessed";

declare module "@types/blessed" {
  namespace Widgets {
    interface TBorder {
      type?: "line" | "bg" | undefined;
      ch?: string | undefined;
      bg?: string | number | undefined;
      fg?: string | number | undefined;
      bold?: string | undefined;
      underline?: string | undefined;
    }

    interface TStyleBorder {
      type?: "line" | "bg" | undefined;
      ch?: string | undefined;
      bg?: string | number | undefined;
      fg?: string | number | undefined;
      bold?: string | undefined;
      underline?: string | undefined;
    }

    interface BoxOptions {
      border?: TBorder | "line" | "bg" | undefined;
    }
  }
}
