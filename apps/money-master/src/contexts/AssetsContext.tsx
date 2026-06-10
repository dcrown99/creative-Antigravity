"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { Portfolio } from "@/types";
import { getPortfolio, updateAssetJson, deleteAsset as deleteAssetAction } from "@/lib/actions";

interface AssetsContextType {
    assets: Portfolio;
    setAssets: (assets: Portfolio) => void;
    refreshAssets: () => Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateAsset: (id: string, data: any) => Promise<void>; // Using any for now to avoid import issues, ideally Asset
    deleteAsset: (id: string) => Promise<void>;
}

const AssetsContext = createContext<AssetsContextType | undefined>(undefined);

export function AssetsProvider({
    children,
    initialData,
}: {
    children: React.ReactNode;
    initialData: Portfolio;
}) {
    const [assets, setAssets] = useState<Portfolio>(initialData);
    const lastInitialDataRef = useRef<string>(JSON.stringify(initialData));

    // Sync with initialData when it changes (e.g., after router.refresh())
    useEffect(() => {
        const currentInitialDataStr = JSON.stringify(initialData);
        if (currentInitialDataStr !== lastInitialDataRef.current) {
            setAssets(initialData);
            lastInitialDataRef.current = currentInitialDataStr;
        }
    }, [initialData]);

    const refreshAssets = useCallback(async () => {
        try {
            const data = await getPortfolio();
            setAssets(data);
        } catch (error) {
            console.error("Failed to refresh assets:", error);
        }
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateAsset = useCallback(async (id: string, data: any) => {
        try {
            await updateAssetJson(id, data);
            await refreshAssets();
        } catch (error) {
            console.error("Failed to update asset:", error);
        }
    }, [refreshAssets]);

    const deleteAsset = useCallback(async (id: string) => {
        try {
            await deleteAssetAction(id);
            await refreshAssets();
        } catch (error) {
            console.error("Failed to delete asset:", error);
        }
    }, [refreshAssets]);

    return (
        <AssetsContext.Provider value={{ assets, setAssets, refreshAssets, updateAsset, deleteAsset }}>
            {children}
        </AssetsContext.Provider>
    );
}

export function useAssetsContext() {
    const context = useContext(AssetsContext);
    if (context === undefined) {
        throw new Error("useAssetsContext must be used within an AssetsProvider");
    }
    return context;
}
