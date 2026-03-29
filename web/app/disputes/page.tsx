'use client';
import Navbar from "../components/Navbar";

export default function DisputesPage() {
    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <div className="container mx-auto px-4 py-12">
                <h1 className="text-3xl font-bold mb-4">Dispute Resolution</h1>
                <p>Participate in outcome verification and earn rewards.</p>
            </div>
        </main>
    );
}
