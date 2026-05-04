import type { Client } from "ldapjs";
import ldap from "ldapjs";

export type LdapAuthStatus =
  | "SUCCESS"
  | "DISABLED"
  | "CONFIG_ERROR"
  | "CONNECTION_ERROR"
  | "INVALID_CREDENTIALS"

export interface LdapUserInfo {
  dn: string
  username: string
}

export interface LdapAuthResult {
  status: LdapAuthStatus
  user?: LdapUserInfo
  error?: string
}

function getEnv(name: string): string | undefined {
  const value = process.env[name]
  return value && value.trim().length > 0 ? value.trim() : undefined
}

function isLdapEnabled(): boolean {
  return (getEnv("ENABLE_LDAP")  || "true")=== "true"
}

function createLdapClient(): Client {
  const url = getEnv("LDAP_URL") || "ldaps://172.16.10.102:636"
  if (!url) {
    throw new Error("LDAP_URL is not configured")
  }

  const tlsOptions = {
    rejectUnauthorized: false
  }

  return ldap.createClient({
    url,
    tlsOptions,
  })
}

function ldapBind(client: Client, dn: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve()
    })
  })
}

function ldapUnbind(client: Client): Promise<void> {
  return new Promise((resolve) => {
    try {
      client.unbind(() => resolve())
    } catch {
      resolve()
    }
  })
}

export async function authenticateWithLdap(
  username: string,
  password: string
): Promise<LdapAuthResult> {
  if (!isLdapEnabled()) {
    return { status: "DISABLED" }
  }

  if (!username || !password) {
    return { status: "INVALID_CREDENTIALS", error: "用户名或密码为空" }
  }

  const adDomain = getEnv("LDAP_AD_DOMAIN") ||"itg.net"
  if (!adDomain) {
    return {
      status: "CONFIG_ERROR",
      error: "LDAP_AD_DOMAIN 未配置",
    }
  }

  let client: Client | undefined

  try {
    client = createLdapClient()

    // Windows AD 认证：使用 userPrincipalName 或 domain\username 格式
    const userPrincipal = adDomain ? `${username}@${adDomain}` : username

    // 直接使用用户账号密码进行绑定验证
    await ldapBind(client, userPrincipal, password)

    // 绑定成功后，返回用户信息
    const userInfo: LdapUserInfo = {
      dn: userPrincipal,
      username,
    }

    return {
      status: "SUCCESS",
      user: userInfo,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.toLowerCase().includes("invalid credentials")) {
      return { status: "INVALID_CREDENTIALS", error: message }
    }

    return {
      status: "CONNECTION_ERROR",
      error: message,
    }
  } finally {
    if (client) {
      await ldapUnbind(client)
    }
  }
}
