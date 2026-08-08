// Iconos del design system — set tipo Phosphor (24x24, stroke)
// Framer original usa Phosphor Icons. Este es el set mínimo del DS;
// se expande agregando paths aquí.

const icons: Record<string, string> = {
  arrowRight:
    '<path d="M4 12h16M13 5l7 7-7 7"/>',
  arrowUpRight:
    '<path d="M7 17L17 7M8 7h9v9"/>',
  arrowLeft:
    '<path d="M20 12H4M11 5l-7 7 7 7"/>',
  arrowDown:
    '<path d="M12 4v16M5 13l7 7 7-7"/>',
  check:
    '<path d="M4 12l5 5L20 6"/>',
  close:
    '<path d="M6 6l12 12M18 6L6 18"/>',
  menu:
    '<path d="M4 6h16M4 12h16M4 18h16"/>',
  chevronRight:
    '<path d="M9 5l7 7-7 7"/>',
  chevronLeft:
    '<path d="M15 5l-7 7 7 7"/>',
  chevronDown:
    '<path d="M5 9l7 7 7-7"/>',
  plus:
    '<path d="M12 5v14M5 12h14"/>',
  minus:
    '<path d="M5 12h14"/>',
  mail:
    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  phone:
    '<path d="M5 4h4l2 5-3 2a13 13 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  clock:
    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  search:
    '<circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/>',
  external:
    '<path d="M14 4h6v6M20 4l-9 9M14 10v10H4V10z"/>',
  mapPin:
    '<path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  whatsapp:
    '<path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3zm0 1.5a7.5 7.5 0 1 1-3.9 13.9l-.3-.2-2.7-2.7-.2-.3A7.5 7.5 0 0 1 12 4.5zm-3.2 3.6c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.8 2.2.9 2.6.7 2.9.6.3-.1.6-.4.7-1 .1-.6.2-1.1.2-1.2l-.4-.3-1.4-.7c-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6 6 0 0 1-3-2.6c-.1-.2 0-.4.1-.5l.6-.7c.1-.2.1-.3 0-.5l-.7-1.4c-.2-.4-.3-.4-.5-.4z"/>',
  instagram:
    '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.8"/>',
  linkedin:
    '<path d="M6.5 8.5v10M3 5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0M10.5 18.5v-6a2.5 2.5 0 0 1 5 0v6M10.5 8.5v10"/>',
  xTwitter:
    '<path d="M4 4l7.2 9.3L4.3 20h2.6l5.4-5.4L16.8 20H20l-7.5-9.7L19 4h-2.6l-4.8 4.9L7.2 4H4z"/>',
  facebook:
    '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v8h4v-8h3l1-4h-4V8a1 1 0 0 1 1-1z"/>',
  quote:
    '<path d="M8 6C5 6 3 8.5 3 11.5V18h6v-6H5.5C5.5 9 6.5 8 8 8V6zm13 0c-3 0-5 2.5-5 5.5V18h6v-6h-3.5C18.5 9 19.5 8 21 8V6z"/>',
  sparkle:
    '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 15l.9 2.6L22.5 18l-2.6.9L19 21.5l-.9-2.6L15.5 18l2.6-.9L19 15z"/>',
};

export function getIcon(name: string): string | undefined {
  return icons[name];
}

export function hasIcon(name: string): boolean {
  return name in icons;
}
