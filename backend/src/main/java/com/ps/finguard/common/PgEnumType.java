package com.ps.finguard.common;

import org.hibernate.HibernateException;
import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.usertype.UserType;

import java.io.Serializable;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.Objects;

/**
 * Base Hibernate UserType for mapping a Java enum to a Postgres enum type.
 * Subclasses only need to declare the enum class + Postgres type name.
 */
public abstract class PgEnumType<E extends Enum<E>> implements UserType<E> {

    protected abstract Class<E> enumClass();

    @Override
    public int getSqlType() {
        return Types.OTHER;
    }

    @Override
    public Class<E> returnedClass() {
        return enumClass();
    }

    @Override
    public boolean equals(E x, E y) {
        return Objects.equals(x, y);
    }

    @Override
    public int hashCode(E x) {
        return Objects.hashCode(x);
    }

    @Override
    public E nullSafeGet(ResultSet rs, int position, SharedSessionContractImplementor session, Object owner)
            throws SQLException {
        String value = rs.getString(position);
        return value == null ? null : Enum.valueOf(enumClass(), value);
    }

    @Override
    public void nullSafeSet(PreparedStatement st, E value, int index, SharedSessionContractImplementor session)
            throws SQLException {
        if (value == null) {
            st.setNull(index, Types.OTHER);
        } else {
            st.setObject(index, value.name(), Types.OTHER);
        }
    }

    @Override
    public E deepCopy(E value) {
        return value;
    }

    @Override
    public boolean isMutable() {
        return false;
    }

    @Override
    public Serializable disassemble(E value) {
        return value;
    }

    @Override
    public E assemble(Serializable cached, Object owner) {
        @SuppressWarnings("unchecked")
        E v = (E) cached;
        return v;
    }
}
