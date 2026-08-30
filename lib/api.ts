const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

export const fetcher = async (url: string) => {
  const res = await fetch(`${API_BASE_URL}${url}`); // ← no prefix
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    const data = await res.json().catch(() => ({}));
    error.message = data.error || res.statusText;
    throw error;
  }
  return res.json();
};

export const postData = async (url: string, data: any) => {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const error = new Error('An error occurred while posting the data.');
    const errorData = await res.json().catch(() => ({}));
    error.message = errorData.error || res.statusText;
    throw error;
  }

  return res.json();
};

export const patchData = async (url: string, data: any) => {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const error = new Error(await res.text());
    throw error;
  }

  return res.json();
};

export const deleteData = async (url: string) => {
  const res = await fetch(`${API_BASE_URL}${url}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};