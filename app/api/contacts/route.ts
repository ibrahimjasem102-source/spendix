import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ContactFormData } from "@/types";

const CONTACT_SELECT = "id,user_id,name,type,phone,email,notes,created_at,updated_at";
const CONTACT_TYPES = new Set(["person", "company", "bank", "other"]);

function isMissingContactsTable(message: string) {
  return message.includes("financial_contacts") &&
    (message.includes("schema cache") || message.includes("Could not find") || message.includes("does not exist"));
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("financial_contacts")
    .select(CONTACT_SELECT)
    .eq("user_id", user.id)
    .order("name");

  if (error) {
    if (isMissingContactsTable(error.message)) {
      return NextResponse.json({ contacts: [], contactsAvailable: false, setupRequired: "supabase/migrations/005_financial_contacts.sql" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ contacts: data, contactsAvailable: true });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: ContactFormData = await request.json();
  const name = body.name?.trim();
  const type = CONTACT_TYPES.has(body.type) ? body.type : "person";

  if (!name) {
    return NextResponse.json({ errorKey: "contacts.name_required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("financial_contacts")
    .insert({
      user_id: user.id,
      name,
      type,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      notes: body.notes?.trim() || null,
    })
    .select(CONTACT_SELECT)
    .single();

  if (error) {
    if (isMissingContactsTable(error.message)) {
      return NextResponse.json(
        {
          errorKey: "contacts.setup_required",
          error: "Financial contacts table is missing. Apply supabase/migrations/005_financial_contacts.sql in Supabase.",
          setupRequired: "supabase/migrations/005_financial_contacts.sql",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }
  return NextResponse.json({ contact: data }, { status: 201 });
}
