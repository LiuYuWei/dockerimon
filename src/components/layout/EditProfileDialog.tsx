
"use client";

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const profileFormSchema = z.object({
  name: z.string().min(1, "Name cannot be empty.").max(50, "Name is too long."),
  email: z.string().email("Invalid email address.").max(100, "Email is too long."),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine(data => {
  if (data.newPassword && !data.confirmPassword) {
    return false; // Confirm password is required if new password is set
  }
  if (data.newPassword && data.confirmPassword && data.newPassword !== data.confirmPassword) {
    return false; // Passwords must match
  }
  if (data.newPassword && data.newPassword.length < 6) {
    return false; // Password too short
  }
  return true;
}, {
  message: "Passwords must match and be at least 6 characters long, or leave both empty.",
  path: ["confirmPassword"], // Show error under confirmPassword field or a general one
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface EditProfileDialogProps {
  currentName: string;
  currentEmail: string;
  onSave: (data: ProfileFormValues) => void;
}

export function EditProfileDialog({ currentName, currentEmail, onSave }: EditProfileDialogProps) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: currentName,
      email: currentEmail,
      newPassword: "",
      confirmPassword: "",
    }
  });

  useEffect(() => {
    form.reset({
      name: currentName,
      email: currentEmail,
      newPassword: "",
      confirmPassword: "",
    });
  }, [currentName, currentEmail, form]);

  const onSubmit = (data: ProfileFormValues) => {
    // Filter out password fields if they are empty, so we don't send empty strings
    const dataToSave: ProfileFormValues = { name: data.name, email: data.email };
    if (data.newPassword && data.confirmPassword && data.newPassword === data.confirmPassword) {
      dataToSave.newPassword = data.newPassword;
    }
    onSave(dataToSave);
  };

  return (
    <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground shadow-xl rounded-lg">
      <DialogHeader>
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogDescription>
          Make changes to your profile. Click save when you&apos;re done.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Your Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="your.email@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password (optional)</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Leave blank to keep current" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm New Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Confirm new password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
           {form.formState.errors.confirmPassword && !form.formState.errors.newPassword && (
            <p className="text-sm font-medium text-destructive">{form.formState.errors.confirmPassword.message}</p>
          )}
          <DialogFooter className="pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
