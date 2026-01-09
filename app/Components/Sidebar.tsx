"use client";
import { Gauge, Gift } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useProject } from "@/lib/project-context";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getWebsiteLogo } from "@/service/websiteSettings";

export default function Sidebar() {
    const { currentProject, getProjectId } = useProject();
    const params = useParams();
    const projectSlug = (params?.projectSlug as string) || currentProject?.slug || "";
    const projectId = getProjectId();
    const [logoUrl, setLogoUrl] = useState<string>("/logo.png");
    const [isLogoLoading, setIsLogoLoading] = useState<boolean>(true);

    // Fetch dynamic logo - refetch when projectId changes
    useEffect(() => {
        const fetchLogo = async () => {
            setIsLogoLoading(true);
            try {
                const logo = await getWebsiteLogo(projectId || undefined);
                if (logo) {
                    setLogoUrl(logo);
                } else {
                    setLogoUrl("/logo.png");
                }
            } finally {
                setIsLogoLoading(false);
            }
        };
        fetchLogo();
    }, [projectId]);

    let SIDEBAR_DATA = [
        {
            name: "Dashboard",
            href: projectSlug ? `/${projectSlug}` : "/",
            icon: <Gauge />,
        },
        {
            name: "Loot Boxes",
            href: projectSlug ? `/${projectSlug}/lootboxes` : "/lootboxes",
            icon: <Gift />,
        },
    ];
    return (
        <aside
            id="default-sidebar"
            className="fixed top-0 left-0 z-40 w-64 h-screen transition-transform -translate-x-full sm:translate-x-0"
            aria-label="Sidebar">
            <div className="h-full px-3 py-4 overflow-y-auto">
                <ul className="space-y-2 font-medium">
                    <li
                        key={1}
                        className="text-center mb-20 flex items-center justify-center">
                        {isLogoLoading ? (
                            <div className="w-20 h-20 rounded-full bg-white/20 animate-pulse" />
                        ) : (
                            <Image
                                src={logoUrl}
                                alt="logo"
                                width={100}
                                height={100}
                                className="w-20 h-20"
                                unoptimized={logoUrl.startsWith("http")}
                            />
                        )}
                    </li>
                    {SIDEBAR_DATA.map((link) => {
                        return (
                            <li
                                key={link.name}
                                className="bg-foreground text-background rounded-2xl text-xl font-bold px-8 hover:bg-foreground group">
                                <Link
                                    href={link.href}
                                    key={link.name}
                                    className="flex items-center p-2 ">
                                    {link.icon}
                                    <span className="ms-3">{link.name}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </aside>
    );
}
