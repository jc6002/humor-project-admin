"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function profileRedirect(key: "error" | "saved", value: string) {
  const query = new URLSearchParams({ [key]: value });
  redirect(`/profile?${query.toString()}`);
}

export async function updateProfile(formData: FormData) {
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();

  if (!firstName || !lastName) {
    profileRedirect("error", "Please add both your first and last name.");
  }

  if (firstName.length > 80 || lastName.length > 80) {
    profileRedirect("error", "Names must be 80 characters or fewer.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?login=required");
  }

  let avatarUrl: string | undefined;
  const avatar = formData.get("avatar");

  if (avatar instanceof File && avatar.size > 0) {
    if (!avatar.type.startsWith("image/")) {
      profileRedirect("error", "Please choose an image file.");
    }

    if (avatar.size > 5 * 1024 * 1024) {
      profileRedirect("error", "Your image must be smaller than 5 MB.");
    }

    const rawExtension = avatar.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const extension = rawExtension.replace(/[^a-z0-9]/g, "") || "jpg";
    const avatarPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const fileBytes = new Uint8Array(await avatar.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(avatarPath, fileBytes, {
        contentType: avatar.type,
        cacheControl: "3600",
      });

    if (uploadError) {
      profileRedirect("error", `Photo upload failed: ${uploadError.message}`);
    }

    avatarUrl = supabase.storage.from("avatars").getPublicUrl(avatarPath)
      .data.publicUrl;
  }

  const updates: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    updated_at: string;
  } = {
    id: user.id,
    first_name: firstName,
    last_name: lastName,
    updated_at: new Date().toISOString(),
  };

  if (avatarUrl) {
    updates.avatar_url = avatarUrl;
  }

  const { error } = await supabase.from("profiles").upsert(updates);

  if (error) {
    profileRedirect("error", `Profile update failed: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/profile");
  revalidatePath("/members");
  profileRedirect("saved", "1");
}
