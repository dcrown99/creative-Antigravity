'use client';

import { Card, CardContent, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { AllocationData, AllocationItem } from "@/services/analytics.service";
import { formatCurrency } from "@/lib/utils";

interface AssetAllocationChartProps {
    data: AllocationData;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const LABEL_MAPPING: Record<string, string> = {
    // Asset Types
    'bank': '銀行口座',
    'cash': '銀行口座',
    'stock': '株式',
    'trust': '投資信託',
    'crypto': '暗号資産',
    'bond': '債券',
    'other': 'その他',
    'ETF': 'ETF',
    'US_STOCK': '米国株',
    'JP_STOCK': '日本株',
    'TRUST': '投資信託',

    // Currencies
    'JPY': '日本円',
    'USD': '米ドル',
    'EUR': 'ユーロ',

    // Account Types
    'NISA_GROWTH': 'NISA成長投資枠',
    'TOKUTEI': '特定口座',
    'NISA_TSUMITATE': 'NISAつみたて投資枠',
    'IDECO': 'iDeCo',
    'Unknown': '不明',
    'NISA': 'NISA口座',
};

function translateData(data: AllocationItem[]): AllocationItem[] {
    if (!data) return [];
    return data.map(item => ({
        ...item,
        name: LABEL_MAPPING[item.name] || item.name
    }));
}

function CustomPieChart({ data }: { data: AllocationItem[] }) {
    if (!data || data.length === 0) {
        return <div className="flex h-full items-center justify-center text-muted-foreground">データがありません</div>;
    }

    const translatedData = translateData(data);

    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                    data={translatedData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                >
                    {translatedData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    );
}

export function AssetAllocationChart({ data }: AssetAllocationChartProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>資産配分</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="type" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="type">種類別</TabsTrigger>
                        <TabsTrigger value="currency">通貨別</TabsTrigger>
                        <TabsTrigger value="account">口座別</TabsTrigger>
                    </TabsList>
                    <div className="h-[300px] w-full mt-4">
                        <TabsContent value="type" className="h-full">
                            <CustomPieChart data={data.byType} />
                        </TabsContent>
                        <TabsContent value="currency" className="h-full">
                            <CustomPieChart data={data.byCurrency} />
                        </TabsContent>
                        <TabsContent value="account" className="h-full">
                            <CustomPieChart data={data.byAccount} />
                        </TabsContent>
                    </div>
                </Tabs>
            </CardContent>
        </Card>
    );
}
