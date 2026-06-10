import AvatarCanvas from "@/components/canvas/AvatarCanvas";
import { ConversationUI } from "@/components/interface/ConversationUI";

export default function Home() {
    return (
        <main className="relative h-full w-full overflow-hidden bg-black">
            {/* 3D Layer - Full Screen */}
            <div className="absolute inset-0 z-0">
                <AvatarCanvas />
            </div>

            {/* UI Layer - Overlay */}
            <ConversationUI />
        </main>
    );
}
