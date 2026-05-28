import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ContactFormData } from "@/types";

type Params = { params: Promise<{ id: string }> };
const CONTACT_SELECT = "id,user_id,name,type,phone,email,notes,created_at,updated_at";

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: Partial<ContactFormData> = await request.json();

  const { data, error } = await supabase
    .from("financial_contacts")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id)
    .select(CONTACT_SELECT).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("financial_contacts")
    .delete()
    .eq("id", id).eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
