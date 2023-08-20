import type GLib from 'gi://GLib';

export interface GVariantFormat {
  toGVariant(): GLib.Variant;
}
