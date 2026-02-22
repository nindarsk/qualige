
-- Tighten the organizations insert policy to prevent abuse
-- Drop the overly permissive policy
DROP POLICY "Authenticated users can create organizations" ON public.organizations;

-- Create a more restrictive policy: only users without an org can create one
CREATE POLICY "Users without org can create organization"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_organization_id(auth.uid()) IS NULL);
