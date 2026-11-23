export type NavIconName = "dashboard" | "inventory" | "scan" | "movement" | "people" | "request" | "report" | "settings" | "menu";

export default function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "dashboard" && <><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></>}
      {name === "inventory" && <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v8.5"/></>}
      {name === "scan" && <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 9h3v3H7zM14 9h3M14 12v3M9 16h2M17 16h.01"/></>}
      {name === "movement" && <><path d="M7 7h13l-3-3M17 17H4l3 3"/><path d="M20 7a6 6 0 0 1-6 6M4 17a6 6 0 0 1 6-6"/></>}
      {name === "people" && <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20v-1.5a5.5 5.5 0 0 1 11 0V20zM16 5.2a3.2 3.2 0 0 1 0 6.2M17 14.5a5 5 0 0 1 3.5 4.8V20h-4"/></>}
      {name === "request" && <><path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z"/><path d="M14 3.5v4h4M8.5 12h7M8.5 16h5M8.5 8.5h1"/></>}
      {name === "report" && <><path d="M4 20V11M10 20V5M16 20v-7M22 20H2"/><path d="m4 8 5-4 5 6 6-5"/></>}
      {name === "settings" && <><path d="M4 7h5M13 7h7M4 17h9M17 17h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></>}
      {name === "menu" && <><path d="M4 6h16M4 12h16M4 18h16"/></>}
    </svg>
  );
}
