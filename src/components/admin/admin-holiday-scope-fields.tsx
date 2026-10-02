"use client";

import { useState } from "react";

export function AdminHolidayScopeFields({
  departments,
  initialCompanyWide,
  initialDepartmentId,
}: {
  departments: Array<{
    id: string;
    name: string;
    code: string;
    isActive: boolean;
  }>;
  initialCompanyWide: boolean;
  initialDepartmentId?: string | null;
}) {
  const [companyWide, setCompanyWide] = useState(initialCompanyWide);

  return (
    <>
      <label className="request-check admin-check">
        <input
          type="checkbox"
          name="is_company_wide"
          checked={companyWide}
          onChange={(event) => setCompanyWide(event.target.checked)}
        />
        <span>Company-wide holiday</span>
      </label>

      {!companyWide ? (
        <label className="f">
          <span>Department *</span>
          <select
            name="department_id"
            defaultValue={initialDepartmentId ?? ""}
            required
          >
            <option value="" disabled>
              Select department
            </option>
            {departments
              .filter(
                (department) =>
                  department.isActive || department.id === initialDepartmentId,
              )
              .map((department) => (
                <option value={department.id} key={department.id}>
                  {department.name} ({department.code})
                </option>
              ))}
          </select>
        </label>
      ) : null}
    </>
  );
}
