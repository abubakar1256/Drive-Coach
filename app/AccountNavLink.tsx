"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AccountNavLink({ className = "login-link" }: { className?: string }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { setSignedIn(Boolean(window.sessionStorage.getItem("routepilot.accessToken"))); }, []);
  return <Link className={className} href={signedIn ? "/account" : "/auth/login"}>{signedIn ? "My account" : "Log in"}</Link>;
}
