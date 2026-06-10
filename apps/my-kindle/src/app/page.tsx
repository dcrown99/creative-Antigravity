'use client';

import { useState, forwardRef } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
// import Link from 'next/link';
// import Image from 'next/image';
import { SettingsDialog } from '@/components/settings-dialog';
// import { Button } from '@repo/ui';
import { Input } from '@repo/ui';
import { useLibrary } from '@/hooks/use-library';
import { Search, Layers, Grid } from 'lucide-react';
import { FilterOption, SortOption } from '@/types';
import { SeriesCard } from '@/components/features/series-card';
import { BookCard } from '@/components/features/book-card';
import { ReadingStats } from '@/components/features/reading-stats';
import { ContinueReadingShelf } from '@/components/features/continue-reading-shelf';

export default function LibraryPage() {
  const {
    books,
    groupedBooks,
    allBooks,
    recentBooks,
    isLoading,
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    sortOption,
    setSortOption
  } = useLibrary();

  const [isSeriesMode, setIsSeriesMode] = useState(true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-6">
      <header className="flex flex-col gap-6 mb-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ライブラリ</h1>
            <p className="text-zinc-400 text-sm mt-1">
              {books.length} 冊のブックが見つかりました
            </p>
          </div>
          <div className="flex gap-2">
            <ReadingStats books={allBooks} />
            <SettingsDialog />
          </div>
        </div>

        {/* Continue Reading Shelf (Only show if no search/filter is active) */}
        {!searchQuery && filterStatus === 'all' && recentBooks.length > 0 && (
          <ContinueReadingShelf books={recentBooks} />
        )}

        {/* Controls Bar */}
        {allBooks.length > 0 && (
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-zinc-900/50 p-4 rounded-lg border border-zinc-800">
            {/* Search */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                placeholder="タイトルを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-zinc-900 border-zinc-700 focus-visible:ring-zinc-600"
              />
            </div>

            <div className="flex flex-wrap gap-4 w-full md:w-auto">
              {/* Filter Tabs */}
              <div className="flex bg-zinc-900 rounded-md p-1 border border-zinc-800">
                {(['all', 'unread', 'reading', 'finished'] as FilterOption[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setFilterStatus(filter)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${filterStatus === filter
                      ? 'bg-zinc-700 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                  >
                    {filter === 'all' && 'すべて'}
                    {filter === 'unread' && '未読'}
                    {filter === 'reading' && '読書中'}
                    {filter === 'finished' && '読了'}
                  </button>
                ))}
              </div>

              {/* View Mode Toggle */}
              <div className="flex bg-zinc-900 rounded-md p-1 border border-zinc-800">
                <button
                  onClick={() => setIsSeriesMode(true)}
                  className={`p-1.5 rounded-sm transition-colors ${isSeriesMode ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                  title="シリーズ表示"
                >
                  <Layers className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsSeriesMode(false)}
                  className={`p-1.5 rounded-sm transition-colors ${!isSeriesMode ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                  title="一覧表示"
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>

              {/* Sort Dropdown (Simple Select for now) */}
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-md focus:ring-zinc-600 focus:border-zinc-600 block p-2"
              >
                <option value="latest_added">追加日順</option>
                <option value="last_read">最近読んだ順</option>
                <option value="alphabetical">名前順</option>
              </select>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto">
        {allBooks.length === 0 ? (
          <div className="flex flex-col gap-6">
            {/* Not Found Message */}
            <div className="text-center py-10 bg-zinc-900/50 rounded-lg border border-zinc-800 border-dashed">
              <p className="text-zinc-500 mb-4 font-medium">本が見つかりませんでした。</p>
              <p className="text-sm text-zinc-600 mb-6">
                右上の設定ボタンからフォルダパスを確認してください。
              </p>
            </div>
          </div>
        ) : (
          <>
            {books.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-zinc-500">条件に一致する本が見つかりませんでした。</p>
              </div>
            ) : (
              isSeriesMode ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {groupedBooks.map((group) => (
                    group.isSeries ? (
                      <SeriesCard key={group.id} series={group} />
                    ) : (
                      <BookCard key={group.coverBook.name} book={group.coverBook} />
                    )
                  ))}
                </div>
              ) : (
                <VirtuosoGrid
                  style={{ height: 'calc(100vh - 200px)' }}
                  totalCount={books.length}
                  components={{
                    List: VirtuosoList,
                    Item: ({ children, ...props }) => (
                      <div {...props} className="h-full">
                        {children}
                      </div>
                    )
                  }}
                  itemContent={(index) => (
                    <BookCard book={books[index]} />
                  )}
                />
              )
            )}
          </>
        )}
      </main>
    </div >
  );
}

const VirtuosoList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
  <div
    ref={ref}
    {...props}
    style={style}
    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-20"
  >
    {children}
  </div>
));
VirtuosoList.displayName = 'VirtuosoList';
