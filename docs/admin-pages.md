# 管理后台页面设计

## 页面结构

### 1. 管理后台布局 (/admin)
```
┌─────────────────────────────────────────┐
│ 顶部导航栏                                │
│ [Logo] SGA 管理后台    [用户] [退出]        │
├─────────────────────────────────────────┤
│ 侧边栏    │ 主内容区域                     │
│ - 公司设置 │                             │
│ - 部门管理 │                             │
│ - Agent管理│                             │
│ - 用户管理 │                             │
│ - 权限管理 │                             │
└─────────────────────────────────────────┘
```

### 2. 公司设置页面 (/admin/company)
- **公司名称输入框**
- **Logo上传区域**（拖拽上传 + 预览）
- **保存按钮**

### 3. 部门管理页面 (/admin/departments)
- **部门列表表格**
  - 部门名称
  - 描述
  - 图标
  - Agent数量
  - 操作（编辑/删除）
- **添加部门按钮**
- **部门编辑弹窗**

### 4. Agent管理页面 (/admin/agents)
- **Agent列表表格**
  - 头像
  - 中文名/英文名
  - 岗位
  - 所属部门
  - 在线状态
  - 操作（编辑/删除/测试连接）
- **添加Agent按钮**
- **Agent详情编辑页面**

### 5. 用户管理页面 (/admin/users)
- **用户列表表格**
  - 头像
  - 用户ID
  - 显示名称
  - 手机号
  - 角色
  - 最后登录
  - 操作（编辑/删除/设置权限）
- **添加用户按钮**
- **用户编辑弹窗**

### 6. 权限管理页面 (/admin/permissions)
- **用户-Agent权限矩阵**
  - 左侧：用户列表
  - 顶部：Agent列表（按部门分组）
  - 交叉点：权限开关
- **批量操作**
  - 按部门批量授权
  - 按用户批量授权

## 关键组件设计

### Agent编辑表单
```jsx
<AgentForm>
  <Input label="中文名" required />
  <Input label="英文名" />
  <Input label="岗位" required />
  <Select label="所属部门" options={departments} required />
  <Textarea label="能力介绍" />
  <ImageUpload label="头像" accept="image/*" />
  <ImageUpload label="照片" accept="image/*" />
  <Input label="Dify URL" />
  <Input label="Dify Key" type="password" />
  <Button onClick={testConnection}>测试连接</Button>
</AgentForm>
```

### 权限矩阵组件
```jsx
<PermissionMatrix>
  <UserList />
  <AgentGrid>
    {departments.map(dept => (
      <DepartmentGroup key={dept.id}>
        <DepartmentHeader>{dept.name}</DepartmentHeader>
        {dept.agents.map(agent => (
          <AgentColumn key={agent.id}>
            <AgentHeader>{agent.name}</AgentHeader>
            {users.map(user => (
              <PermissionToggle 
                key={`${user.id}-${agent.id}`}
                userId={user.id}
                agentId={agent.id}
                granted={hasPermission(user.id, agent.id)}
                onChange={togglePermission}
              />
            ))}
          </AgentColumn>
        ))}
      </DepartmentGroup>
    ))}
  </AgentGrid>
</PermissionMatrix>
```

## 页面路由
- `/admin` - 管理后台首页（重定向到公司设置）
- `/admin/company` - 公司设置
- `/admin/departments` - 部门管理
- `/admin/agents` - Agent管理
- `/admin/agents/new` - 新建Agent
- `/admin/agents/:id/edit` - 编辑Agent
- `/admin/users` - 用户管理
- `/admin/permissions` - 权限管理

## 权限控制
- 所有 `/admin/*` 路由需要管理员权限
- 非管理员访问自动跳转到主页面
- 管理员可以在主页面和管理后台之间切换
