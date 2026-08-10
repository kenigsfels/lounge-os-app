import { getEmployees, replaceEmployees } from './employees.js';
import {
  chooseNewestSchedule,
  hasScheduleData,
  loadScheduleData,
  saveScheduleData
} from './schedule.js';
import { getCloudSession, getSupabaseClient, isSupabaseConfigured } from './supabase.js';

function toCloudEmployee(employee, venueId, userId) {
  return {
    id: employee.id,
    venue_id: venueId,
    name: employee.name,
    position: employee.position,
    phone: employee.phone || '',
    status: employee.status,
    rate: Number(employee.rate) || 0,
    start_date: employee.startDate || null,
    notes: employee.notes || '',
    created_by: userId,
    created_at: employee.createdAt,
    updated_at: employee.updatedAt
  };
}

function fromCloudEmployee(employee) {
  return {
    id: employee.id,
    name: employee.name,
    position: employee.position,
    phone: employee.phone || '',
    status: employee.status,
    rate: Number(employee.rate) || 0,
    startDate: employee.start_date || '',
    notes: employee.notes || '',
    createdAt: employee.created_at,
    updatedAt: employee.updated_at
  };
}

async function getCloudContext() {
  if (!isSupabaseConfigured()) return null;
  const session = await getCloudSession();
  if (!session) return null;

  const supabase = getSupabaseClient();
  const { data: membership, error } = await supabase
    .from('venue_members')
    .select('venue_id, role')
    .eq('user_id', session.user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!membership) throw new Error('Для пользователя не создано заведение');
  return { supabase, session, membership };
}

export async function synchronizeEmployees() {
  const context = await getCloudContext();
  if (!context) return { success: false, connected: false, employees: getEmployees() };

  const { supabase, session, membership } = context;
  const { data: cloudRows, error } = await supabase
    .from('employees')
    .select('*')
    .eq('venue_id', membership.venue_id)
    .order('name');
  if (error) throw error;

  const merged = new Map();
  cloudRows.map(fromCloudEmployee).forEach((employee) => merged.set(employee.id, employee));
  getEmployees().forEach((employee) => {
    const cloudEmployee = merged.get(employee.id);
    if (!cloudEmployee || new Date(employee.updatedAt) > new Date(cloudEmployee.updatedAt)) {
      merged.set(employee.id, employee);
    }
  });

  const employees = [...merged.values()];
  if (employees.length > 0) {
    const payload = employees.map((employee) => (
      toCloudEmployee(employee, membership.venue_id, session.user.id)
    ));
    const { error: upsertError } = await supabase.from('employees').upsert(payload);
    if (upsertError) throw upsertError;
  }

  replaceEmployees(employees);
  return { success: true, connected: true, employees };
}

export async function saveEmployeeToCloud(employee) {
  const context = await getCloudContext();
  if (!context) return { success: false, connected: false };
  const { supabase, session, membership } = context;
  const payload = toCloudEmployee(employee, membership.venue_id, session.user.id);
  const { error } = await supabase.from('employees').upsert(payload);
  if (error) throw error;
  return { success: true, connected: true };
}

export async function deleteEmployeeFromCloud(employeeId) {
  const context = await getCloudContext();
  if (!context) return { success: false, connected: false };
  const { supabase, membership } = context;
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('venue_id', membership.venue_id)
    .eq('id', employeeId);
  if (error) throw error;
  return { success: true, connected: true };
}

export async function synchronizeSchedule() {
  const localSchedule = await loadScheduleData();
  const context = await getCloudContext();
  if (!context) {
    return { success: false, connected: false, schedule: localSchedule, source: 'local' };
  }

  const { supabase, session, membership } = context;
  const { data: cloudRow, error } = await supabase
    .from('schedules')
    .select('payload, updated_at')
    .eq('venue_id', membership.venue_id)
    .maybeSingle();
  if (error) throw error;

  const selected = chooseNewestSchedule(
    localSchedule,
    cloudRow?.payload,
    cloudRow?.updated_at
  );

  if (selected.source === 'local' && hasScheduleData(selected.schedule)) {
    const { error: upsertError } = await supabase.from('schedules').upsert({
      venue_id: membership.venue_id,
      payload: selected.schedule,
      updated_by: session.user.id
    });
    if (upsertError) throw upsertError;
  }

  saveScheduleData(selected.schedule);
  return {
    success: true,
    connected: true,
    schedule: selected.schedule,
    source: selected.source
  };
}

export async function synchronizeCloudData() {
  const [employees, schedule] = await Promise.all([
    synchronizeEmployees(),
    synchronizeSchedule()
  ]);
  return { employees, schedule };
}
