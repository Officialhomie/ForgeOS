import { NextResponse } from 'next/server'
import { taskStore } from '@/lib/oneshot/task-store'

type Params = { taskId: string }

export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  const { taskId } = await params
  const task = taskStore.get(taskId)
  if (!task) {
    return NextResponse.json(
      { success: false, error: 'Task not found' },
      { status: 404 },
    )
  }
  return NextResponse.json({ success: true, task })
}
