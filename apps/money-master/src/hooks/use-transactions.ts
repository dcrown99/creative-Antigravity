"use client";

import { useState, useEffect } from "react";
import { getTransactions, saveTransactionsToServer } from "@/lib/actions";
import { Transaction } from "@/types";

const STORAGE_KEY = "money-track-transactions";

export function useTransactions() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadTransactions = async () => {
            try {
                // 1. Try to load from server
                const serverData = await getTransactions();

                // 2. If server data is empty, check local storage (Migration)
                if (serverData.length === 0) {
                    const localData = localStorage.getItem(STORAGE_KEY);
                    if (localData) {
                        try {
                            const parsed = JSON.parse(localData);
                            if (Array.isArray(parsed) && parsed.length > 0) {
                                console.log("Migrating data from localStorage to server...");
                                await saveTransactionsToServer(parsed);
                                setTransactions(parsed);
                                // Clear localStorage after successful migration to prevent re-migration
                                localStorage.removeItem(STORAGE_KEY);
                                return;
                            }
                        } catch (e) {
                            console.error("Failed to parse localStorage data", e);
                        }
                    }
                }

                setTransactions(serverData);
            } catch (error) {
                console.error("Failed to load transactions", error);
            } finally {
                setLoading(false);
            }
        };

        loadTransactions();
    }, []);

    const saveTransactions = async (newTransactions: Transaction[]) => {
        try {
            // Save to server
            await saveTransactionsToServer(newTransactions);
            // Update local state
            setTransactions(newTransactions);
        } catch (error) {
            console.error("Failed to save transactions", error);
        }
    };

    const addTransaction = async (transaction: Omit<Transaction, "id" | "createdAt">) => {
        const newTransaction: Transaction = {
            ...transaction,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
        };
        const updated = [newTransaction, ...transactions];
        await saveTransactions(updated);
    };

    const addTransactions = async (newTransactionsData: Omit<Transaction, "id" | "createdAt">[]) => {
        const newTransactions = newTransactionsData.map(t => ({
            ...t,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
        }));
        const updated = [...newTransactions, ...transactions];
        await saveTransactions(updated);
    };

    const deleteTransaction = async (id: string) => {
        const updated = transactions.filter((t) => t.id !== id);
        await saveTransactions(updated);
    };

    const deleteTransactions = async (ids: string[]) => {
        const updated = transactions.filter((t) => !ids.includes(t.id));
        await saveTransactions(updated);
    };

    const updateTransaction = async (id: string, updates: Partial<Omit<Transaction, "id" | "createdAt">>) => {
        const updated = transactions.map((t) =>
            t.id === id ? { ...t, ...updates } : t
        );
        await saveTransactions(updated);
    };

    const updateTransactions = async (ids: string[], updates: Partial<Omit<Transaction, "id" | "createdAt">>) => {
        const updated = transactions.map((t) =>
            ids.includes(t.id) ? { ...t, ...updates } : t
        );
        await saveTransactions(updated);
    };

    return {
        transactions,
        loading,
        addTransaction,
        addTransactions,
        deleteTransaction,
        deleteTransactions,
        updateTransaction,
        updateTransactions,
    };
}
