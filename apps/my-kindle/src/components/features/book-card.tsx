import Link from 'next/link';
import Image from 'next/image';
import { BookOpen } from 'lucide-react';
// 🔄 MIGRATED: @repo/ui のコンポーネントを使用
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle
} from "@repo/ui";
import { Button } from "@repo/ui";
import { LibraryItem } from '@/types';

interface BookCardProps {
    book: LibraryItem & {
        title?: string;
        authors?: string[];
        cover?: string;
        id?: string;
    };
}

export function BookCard({ book }: BookCardProps) {
    // Fallback values for missing metadata
    const title = book.title || book.name;
    const authors = book.authors || [];
    const cover = book.cover;
    const id = book.id || book.name; // Use name as ID if missing

    return (
        <Card className="flex flex-col h-full overflow-hidden hover:shadow-lg transition-shadow">
            <div className="relative aspect-[2/3] w-full bg-muted">
                {cover ? (
                    <Image
                        src={cover}
                        alt={title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 33vw"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <BookOpen className="w-12 h-12" />
                    </div>
                )}
            </div>
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base line-clamp-2" title={title}>
                    {title}
                </CardTitle>
                <div className="text-sm text-muted-foreground line-clamp-1">
                    {authors.length > 0 ? authors.join(', ') : 'Unknown Author'}
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex-grow">
                {/* Progress bar could be added here */}
                {book.progress > 0 && (
                    <div className="w-full bg-secondary h-1 mt-2 rounded-full overflow-hidden">
                        <div
                            className="bg-primary h-full transition-all"
                            style={{ width: `${book.progress}%` }}
                        />
                    </div>
                )}
            </CardContent>
            <CardFooter className="p-4 pt-0 mt-auto">
                <Link href={`/read/${encodeURIComponent(id)}`} className="w-full">
                    <Button className="w-full" variant="secondary">
                        {book.progress > 0 ? 'Continue' : 'Read Now'}
                    </Button>
                </Link>
            </CardFooter>
        </Card>
    );
}
