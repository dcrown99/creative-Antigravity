import { NextResponse } from 'next/server';
import { db, rules } from '@/lib/db';
import { eq } from 'drizzle-orm';
import type { RuleCondition, RuleAction } from '@/lib/db/schema';

/**
 * GET /api/rules - Get all automation rules
 */
export async function GET() {
    try {
        const allRules = await db
            .select()
            .from(rules)
            .orderBy(rules.createdAt);

        return NextResponse.json({ rules: allRules });
    } catch (error) {
        console.error('GET /api/rules error:', error);
        return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 });
    }
}

/**
 * POST /api/rules - Create a new automation rule
 * 
 * Body: {
 *   name: string,
 *   conditions: RuleCondition[],
 *   actions: RuleAction[]
 * }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, conditions, actions } = body;

        if (!name || !conditions || !actions) {
            return NextResponse.json(
                { error: 'name, conditions, and actions are required' },
                { status: 400 }
            );
        }

        const id = crypto.randomUUID();

        await db.insert(rules).values({
            id,
            name,
            conditions: conditions as RuleCondition[],
            actions: actions as RuleAction[],
            isActive: true,
            createdAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            rule: { id, name, conditions, actions, isActive: true },
        });

    } catch (error) {
        console.error('POST /api/rules error:', error);
        return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
    }
}

/**
 * PATCH /api/rules - Update a rule
 * 
 * Body: {
 *   id: string,
 *   name?: string,
 *   conditions?: RuleCondition[],
 *   actions?: RuleAction[],
 *   isActive?: boolean
 * }
 */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, name, conditions, actions, isActive } = body;

        if (!id) {
            return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (conditions !== undefined) updateData.conditions = conditions;
        if (actions !== undefined) updateData.actions = actions;
        if (isActive !== undefined) updateData.isActive = isActive;

        await db
            .update(rules)
            .set(updateData)
            .where(eq(rules.id, id));

        return NextResponse.json({ success: true, id });

    } catch (error) {
        console.error('PATCH /api/rules error:', error);
        return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
    }
}

/**
 * DELETE /api/rules - Delete a rule
 */
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
        }

        await db.delete(rules).where(eq(rules.id, id));

        return NextResponse.json({ success: true, id });

    } catch (error) {
        console.error('DELETE /api/rules error:', error);
        return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
    }
}
