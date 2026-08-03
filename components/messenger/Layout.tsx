"use client";

import { ReactNode } from "react";

type LayoutProps = {
    header: ReactNode;
    messages: ReactNode;
    composer: ReactNode;
};

export default function Layout({
    header,
    messages,
    composer,
}: LayoutProps) {
    return (
        <section className="friends-messenger">

            <header className="friends-messenger-header">
                {header}
            </header>

            <main className="friends-messenger-messages">
                {messages}
            </main>

            <footer className="friends-messenger-composer">
                {composer}
            </footer>

        </section>
    );
}