"use client";

import React, { ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

interface ResizableLayoutProps {
    sidebar: ReactNode;
    articleList: ReactNode;
    readingPane: ReactNode;
    showReadingPane?: boolean;
}

export const ResizableLayout: React.FC<ResizableLayoutProps> = ({
    sidebar,
    articleList,
    readingPane,
    showReadingPane = true,
}) => {
    console.log('[ResizableLayout] Rendering', new Date().toISOString());
    return (
        <div className="h-screen w-full flex">
            {/* Sidebar - Fixed width */}
            <aside className="w-80 flex-shrink-0 border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-900 h-full overflow-hidden">
                {sidebar}
            </aside>

            {/* Main Content - Resizable */}
            <PanelGroup
                direction="horizontal"
                className="flex-1"
                autoSaveId={showReadingPane ? "news-reader-layout-v2-pane" : "news-reader-layout-v2-no-pane"}
                key={showReadingPane ? "group-with-pane" : "group-no-pane"}
            >
                {/* Article List Panel */}
                <Panel
                    defaultSize={showReadingPane ? 40 : 100}
                    minSize={25}
                    maxSize={showReadingPane ? 60 : 100}
                    className="h-full"
                >
                    <div className="h-full overflow-hidden flex flex-col bg-white dark:bg-gray-800">
                        {articleList}
                    </div>
                </Panel>

                {/* Reading Pane Panel */}
                {showReadingPane && (
                    <>
                        <PanelResizeHandle className="w-1 bg-gray-200 dark:bg-gray-600 hover:bg-blue-400 transition-colors cursor-col-resize" />
                        <Panel
                            defaultSize={60}
                            minSize={30}
                            className="h-full"
                        >
                            <div className="h-full overflow-hidden bg-white dark:bg-gray-800">
                                {readingPane}
                            </div>
                        </Panel>
                    </>
                )}
            </PanelGroup>
        </div>
    );
};
